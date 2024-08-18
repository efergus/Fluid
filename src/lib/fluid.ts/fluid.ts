function clamp(val: number, lower: number, higher: number) {
	return Math.max(lower, Math.min(val, higher));
}

class Fluid {
	declare density: number;
	declare numX: number;
	declare numY: number;
	declare h: number;
	declare overrelaxation: number;
	declare u: Float32Array;
	declare v: Float32Array;
	declare u2: Float32Array;
	declare v2: Float32Array;
	declare s: Float32Array;
	declare p: Float32Array;
	declare smoke: Float32Array;
	declare smoke2: Float32Array;

	constructor(density: number, numX: number, numY: number, h: number, overrelaxation = 1.9) {
		this.density = density;
		this.numX = numX;
		this.numY = numY;
		const numCells = this.numX * this.numY;
		// grid spacing
		this.h = h;
		this.overrelaxation = overrelaxation;
		const arr = () => new Float32Array(numCells);
		// Horizontal velocities
		this.u = arr();
		// Vertical velocities
		this.v = arr();
		this.u2 = arr();
		this.v2 = arr();
		// Solidity (0 => solid, 1 => open)
		this.s = arr();
		this.p = arr();
		this.smoke = arr();
		this.smoke2 = arr();
		// this.smoke.fill(1.0);
	}

	idx(x: number, y: number) {
		return x * this.numY + y;
	}

	gravity(dt: number, gravity: number) {
		const X = this.numX;
		const Y = this.numY;
		for (let i = 1; i < X; i++) {
			for (let j = 1; j < Y - 1; j++) {
				const idx = i * Y + j;
				// Open vertical space
				if (this.s[idx] && this.s[idx - 1]) {
					this.v[idx] += gravity * dt;
				}
			}
		}
	}

	solveIncompressibility(iters: number, dt: number) {
		const X = this.numX;
		const Y = this.numY;

		// Coefficient of Pressure
		const cp = (this.density * this.h) / dt;
		let logged = 0;
		let biggest = 0;
		let biggest_i = 0;

		for (let iter = 0; iter < iters; iter++) {
			for (let i = 1; i < X - 1; i++) {
				for (let j = 1; j < Y - 1; j++) {
					const idx = i * Y + j;
					// Solid object
					if (!this.s[idx]) {
						continue;
					}
					const sx0 = this.s[idx - Y];
					const sx1 = this.s[idx + Y];
					const sy0 = this.s[idx - 1];
					const sy1 = this.s[idx + 1];

					const freedom = sx0 + sx1 + sy0 + sy1;
					if (!freedom) {
						continue;
					}

					const divergence = this.u[idx + Y] - this.u[idx] + this.v[idx + 1] - this.v[idx];
					const dp = -(divergence / freedom) * this.overrelaxation;
					this.p[idx] += cp * dp;
					// if (!logged && i > 40 && j == 1) {
					// 	logged += 1;
					// 	console.log({
					// 		divergence,
					// 		freedom,
					// 		idx,
					// 		i,
					// 		j,
					// 		X,
					// 		Y,
					// 		dp,
					// 		p: this.p[idx],
					// 		cp,
					// 		a: [this.u[idx], this.u[idx + 1], this.v[idx], this.v[idx + 1]],
					// 		s: [sx0, sx1, sy0, sy1],
					// 	});
					// }

					this.u[idx] -= sx0 * dp;
					this.u[idx + Y] += sx1 * dp;
					this.v[idx] -= sy0 * dp;
					this.v[idx + 1] += sy1 * dp;
				}
			}
		}

		const amt = 1 - 0.01 * dt;
		for (let i = 1; i < X - 1; i++) {
			for (let j = 1; j < Y - 1; j++) {
				const idx = i * Y + j;

				this.u[idx] *= amt;
				this.v[idx] *= amt;
			}
		}
	}

	extrapolateEdges() {
		const X = this.numX;
		const Y = this.numY;
		const C = Math.floor(Y / 2);
		for (let i = 0; i < X; i++) {
			this.u[i * Y] = this.u[i * Y + 1];
			this.u[i * Y + Y - 1] = this.u[i * Y + Y - 2];
		}
		for (let j = 0; j < Y - 1; j++) {
			this.v[j] = this.v[Y + j];
			this.v[(X - 1) * Y + j] = this.v[(X - 2) * Y + j];
		}
		for (let j = 1; j < Y - 1; j++) {
			this.u[j + Y] = 1.4;
			if (
				Math.abs(j - C) < Y / 16 ||
				(Math.floor((j - C - 8) / 4) % 4 == 0.0 && j > 8 && j < Y - 8)
			) {
				this.smoke[j + Y] = 1.0;
			}
		}
		// this.v[(X - 1) * Y + 8] = -10.0;
		// this.u[Y * 2] = 0.1;
		// this.u[Y * 3 + 3] = 0.1;
	}

	sample(x: number, y: number, field: Float32Array) {
		const X = this.numX;
		const Y = this.numY;
		const h = this.h;

		const dh = 1 / this.h;
		const h2 = h / 2.0;

		x = clamp(x, h, X * h);
		y = clamp(y, h, Y * h);

		let dx = h2;
		let dy = h2;
		if (field === this.u) {
			dx = 0;
		} else if (field === this.v) {
			dy = 0;
		}

		// minus??
		const x0 = clamp(Math.floor((x - dx) * dh), 0, X - 1);
		const tx = (x - dx - x0 * h) * dh;
		const x1 = clamp(x0 + 1, 0, X - 1);

		const y0 = clamp(Math.floor((y - dy) * dh), 0, Y - 1);
		const ty = (y - dy - y0 * h) * dh;
		const y1 = clamp(y0 + 1, 0, Y - 1);

		const sx = 1.0 - tx;
		const sy = 1.0 - ty;

		const val =
			sx * sy * field[x0 * Y + y0] +
			tx * sy * field[x1 * Y + y0] +
			sx * ty * field[x0 * Y + y1] +
			tx * ty * field[x1 * Y + y0];

		if (isNaN(val)) {
			console.log({ x1, y1, idx: x1 * Y + y0, f: field[x1 * Y + y0], sx, sy, tx, ty });
		}

		return val;
	}

	avgU(i: number, j: number) {
		const Y = this.numY;
		const idx = i * Y + j;
		return (this.u[idx - 1] + this.u[idx] + this.u[idx + Y - 1] + this.u[idx + 1]) * 0.25;
	}

	avgV(i: number, j: number) {
		const Y = this.numY;
		const idx = i * Y + j;
		return (this.v[idx - Y] + this.v[idx] + this.v[idx - Y + 1] + this.v[idx + 1]) * 0.25;
	}

	advectVel(dt: number) {
		this.u2.set(this.u);
		this.v2.set(this.v);

		const X = this.numX;
		const Y = this.numY;
		const h = this.h;
		const h2 = h * 0.5;
		let logged = false;

		for (let i = 1; i < X; i++) {
			for (let j = 1; j < Y; j++) {
				const idx = i * Y + j;
				if (this.s[idx] && this.s[idx - Y] && j < Y - 1) {
					let x = i * h;
					let y = j * h + h2;
					let u = this.u[idx];
					const v = this.avgV(i, j);
					u = this.sample(x - dt * u, y - dt * v, this.u);
					if (!logged && isNaN(u)) {
						logged = true;
						console.log({ idx, x, y, u, v, i, j });
					}
					this.u2[idx] = u;
				}
				if (this.s[idx] && this.s[idx - 1] && i < X - 1) {
					let x = i * h + h2;
					let y = j * h;
					const u = this.avgU(i, j);
					let v = this.v[idx];
					v = this.sample(x - dt * u, y - dt * v, this.v);
					this.v2[idx] = v;
				}
			}
		}

		this.u.set(this.u2);
		this.v.set(this.v2);
	}

	advectSmoke(dt: number) {
		this.smoke2.set(this.smoke);

		let X = this.numX;
		let Y = this.numY;
		let h = this.h;
		let h2 = h / 2;

		for (let i = 1; i < X - 1; i++) {
			for (let j = 1; j < Y - 1; j++) {
				const idx = i * Y + j;
				if (this.s[idx]) {
					const u = (this.u[idx] + this.u[idx + Y]) * 0.5;
					const v = (this.v[idx] + this.v[idx + 1]) * 0.5;
					const x = i * h + h2 - dt * u;
					const y = j * h + h2 - dt * v;

					let val = this.sample(x, y, this.smoke);
					// const amt = dt * 0.1;
					// val = val * (1 - amt) + Math.sqrt(val) * amt;
					this.smoke2[idx] = val;
				}
			}
		}

		this.smoke.set(this.smoke2);
	}

	simulate(dt: number, gravity: number, iters: number) {
		this.gravity(dt, gravity);
		this.p.fill(0.0);
		this.solveIncompressibility(iters, dt);
		this.extrapolateEdges();
		this.advectVel(dt);
		this.advectSmoke(dt);
	}

	solidifyRect(x: number, y: number, w: number, h: number) {
		for (let i = x; i < x + w; i++) {
			for (let j = y; j < y + h; j++) {
				this.s[i * this.numY + j] = 0.0;
			}
		}
	}
}

function getSciColor(val: number, minVal: number, maxVal: number) {
	val = clamp(val, minVal, maxVal - 0.001);
	let d = maxVal - minVal;
	val = d == 0.0 ? 0.5 : (val - minVal) / d;
	let m = 0.25;
	let num = Math.floor(val / m);
	let s = (val - num * m) / m;
	let r, g, b;

	switch (num) {
		case 0:
			r = 0.0;
			g = s;
			b = 1.0;
			break;
		case 1:
			r = 0.0;
			g = 1.0;
			b = 1.0 - s;
			break;
		case 2:
			r = s;
			g = 1.0;
			b = 0.0;
			break;
		case 3:
			r = 1.0;
			g = 1.0 - s;
			b = 0.0;
			break;
		default:
			return [0, 0, 0, 255];
	}

	return [255 * r, 255 * g, 255 * b, 255];
}

function draw(ctx: CanvasRenderingContext2D, scale: number, fluid: Fluid) {
	const width = ctx.canvas.width;
	const height = ctx.canvas.height;
	ctx.clearRect(0, 0, width, height);

	const X = fluid.numX;
	const Y = fluid.numY;

	let minP = fluid.p[0];
	let maxP = fluid.p[0];
	let minV = 0;
	let maxV = 0;
	for (let i = 0; i < X * Y; i++) {
		minP = Math.min(minP, fluid.p[i]);
		maxP = Math.max(maxP, fluid.p[i]);
		const v = Math.sqrt(fluid.v[i] ** 2 + fluid.u[i] ** 2);
		if (isNaN(v)) {
			// continue;
		}
		minV = Math.min(minV, v);
		maxV = Math.max(maxV, v);
	}
	console.log({ minP, maxP, minV, maxV });
	const remap = (x: number, l = minP, h = maxP) => Math.floor(((x - l) / (h - l + 0.001)) * 255);

	const data = ctx.createImageData(width, height);
	let dataIdx = 0;
	for (let i = 0; i < X; i++) {
		for (let j = 0; j < Y; j++) {
			let color = [255, 255, 255, 255];
			const idx = i * Y + j;
			if (fluid.s[idx]) {
				const p = fluid.p[idx];
				const v = Math.sqrt(fluid.v[idx] ** 2 + fluid.u[idx] ** 2);
				// const smoke = fluid.smoke[idx] || 0;
				if (isNaN(p) || isNaN(v)) {
					color = [255, 0, 255, 255];
					console.log({ p, v, idx });
				} else {
					const smoke = clamp(fluid.smoke[idx] * 2, 0, 1);
					color = getSciColor(p, minP, maxP);
					for (let k = 0; k < 3; k++) {
						color[k] *= smoke;
					}
					// color[3] = clamp(255 * fluid.smoke[idx], 20, 255);
				}
			}

			const x = Math.floor(i * scale);
			const y = Math.floor((Y - j - 1) * scale);
			for (let xi = x; xi < x + scale; xi++) {
				for (let yi = y; yi < y + scale; yi++) {
					const dataIdx = 4 * (yi * (X * scale) + xi);
					for (let k = 0; k < 4; k++) {
						data.data[dataIdx + k] = color[k];
					}
				}
			}
		}
	}
	for (let i = 0; i < 20; i++) {
		data.data[Y * X * 4 - 20 + i] = 200;
	}

	ctx.putImageData(data, 0, 0);
}

function fluidText(fluid: Fluid) {
	const centerY = Math.floor(fluid.numY / 2);
	let X = 80;
	// F
	fluid.solidifyRect(X, centerY - 20, 10, 40);
	fluid.solidifyRect(X + 10, centerY + 10, 12, 10);
	fluid.solidifyRect(X + 10, centerY - 5, 8, 8);
	X += 22 + 10;
	// L
	fluid.solidifyRect(X, centerY - 20, 10, 40);
	fluid.solidifyRect(X + 10, centerY - 20, 12, 10);
	X += 22 + 10;
	// U
	fluid.solidifyRect(X, centerY - 20, 10, 40);
	fluid.solidifyRect(X + 10, centerY - 20, 10, 10);
	fluid.solidifyRect(X + 20, centerY - 20, 10, 40);
	X += 30 + 10;
	// I
	fluid.solidifyRect(X, centerY - 20, 10, 40);
	X += 10 + 10;

	// D
	fluid.solidifyRect(X, centerY - 20, 10, 40);
	fluid.solidifyRect(X + 10, centerY - 20, 10, 10);
	fluid.solidifyRect(X + 10, centerY + 10, 12, 10);
	fluid.solidifyRect(X + 15, centerY - 18, 10, 36);
	X += 15 + 10;

	for (let i = 80; i < X; i += 24) {
		fluid.solidifyRect(i, centerY + 60, 4, 4);
		fluid.solidifyRect(i, centerY - 64, 4, 4);
	}
}

export function simulate(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	scale = 4.0,
) {
	const fluid = new Fluid(1000, width, height, 1 / height);

	const X = fluid.numX;
	const Y = fluid.numY;
	const S = Math.min(X, Y);

	ctx.canvas.width = X * scale;
	ctx.canvas.height = Y * scale;
	ctx.canvas.style.width = `${X * scale}px`;
	ctx.canvas.style.height = `${Y * scale}px`;
	ctx.canvas.addEventListener('mousemove', (e) => {
		const rect = ctx.canvas.getBoundingClientRect();
		const x = Math.floor((e.clientX - rect.x) / scale);
		const y = Math.floor(Y - (e.clientY - rect.y) / scale);
		const dx = e.movementX / 6;
		const dy = e.movementY / 6;
		for (let i = -1; i < 2; i++) {
			for (let j = -1; j < 2; j++) {
				const fx = x + i;
				const fy = y + j;
				if (fx <= 1 || fy <= 1 || fx >= X - 2 || fy >= Y - 2) {
					continue;
				}

				fluid.v[fx * Y + fy] = dy;
				fluid.u[fx * Y + fy] = dx;
			}
		}
	});
	for (let i = 0; i < X; i++) {
		for (let j = 0; j < Y; j++) {
			const idx = i * Y + j;
			let s = 1.0;
			const x = i / S;
			const y = j / S;
			const v = (x - 0.5) ** 2 + (y - 0.5) ** 2;
			// if (i == 0 || i == X - 1 || j == 0 || v < 0.01) {
			// 	s = 0.0;
			// }
			if (j == 0 || j == Y - 1) {
				s = 0.0;
			}
			fluid.s[idx] = s;
			// if (!(Math.floor(i / 4) % 2) && !(Math.floor(j / 4) % 2)) {
			// 	fluid.smoke[idx] = 1.0;
			// }
		}
	}
	fluidText(fluid);
	// fluid.s[5] = 0.0;
	// fluid.s[Y + 5] = 0.0;
	let frame = 0;

	const step = () => {
		fluid.simulate(1 / 60, 0, 40);
		draw(ctx, scale, fluid);
		frame++;
		if (!(frame % 60)) {
			console.log('Frame', frame);
		}
		// const arr = [];
		// for (let i = 0; i < 4; i++) {
		// 	const idx = (X - 1) * Y - 4 + i;
		// 	arr.push(fluid.u[idx]);
		// }
		// console.log(arr);
	};

	const loop = (frames: number) => {
		if (frames <= 0) {
			return;
		}
		step();
		requestAnimationFrame(() => loop(frames - 1));
	};

	return { step, loop };
}
