import Color from 'colorjs.io';

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
		let biggest = 0;

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
					biggest = Math.max(Math.abs(this.p[idx]), biggest);

					this.u[idx] -= sx0 * dp;
					this.u[idx + Y] += sx1 * dp;
					this.v[idx] -= sy0 * dp;
					this.v[idx + 1] += sy1 * dp;
				}
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
			this.u[j + Y] = 1.0;
			if (
				Math.abs(j - C) < Y / 16 ||
				(Math.floor((j - C - 8) / 4) % 4 == 0.0 && j > 8 && j < Y - 8)
			) {
				this.smoke[j + Y] = 1.0;
			}
		}
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
			tx * ty * field[x1 * Y + y1];

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

	setRect(x: number, y: number, w: number, h: number, field: Float32Array, val: number) {
		for (let i = x; i < x + w; i++) {
			for (let j = y; j < y + h; j++) {
				field[i * this.numY + j] = val;
			}
		}
	}

	solidifyRect(x: number, y: number, w: number, h: number) {
		this.setRect(x, y, w, h, this.s, 0.0);
	}

	smokeRect(x: number, y: number, w: number, h: number) {
		this.setRect(x, y, w, h, this.smoke, 1.0);
	}
}

const colormap = new Array(256).fill(null).map((_, idx) => {
	const amt = idx / 255;
	const color = new Color('oklch', [0.4 + amt * 0.2, 0, 0]);
	color.oklch.c = 0.2;
	color.oklch.h = Math.floor(294 - amt * 300);
	const rgb = [...color.srgb.map((x) => clamp(x * 255, 0, 255)), 255];
	return rgb;
});

function getSciColor(val: number, minVal: number, maxVal: number) {
	val = clamp(val, minVal, maxVal - 0.001);
	let d = maxVal - minVal;
	val = d == 0.0 ? 0.5 : (val - minVal) / d;

	return colormap[Math.floor(val * 255)].slice();
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
		const p = fluid.p[i] * (fluid.smoke[i] ? 1.0 : 0.0);
		minP = Math.min(minP, p);
		maxP = Math.max(maxP, p);
		const v = Math.sqrt(fluid.v[i] ** 2 + fluid.u[i] ** 2);
		minV = Math.min(minV, v);
		maxV = Math.max(maxV, v);
	}

	const data = ctx.createImageData(width, height);
	for (let i = 0; i < X; i++) {
		for (let j = 0; j < Y; j++) {
			let color = [255, 255, 255, 255];
			const idx = i * Y + j;
			if (fluid.s[idx]) {
				const p = fluid.p[idx];
				const v = Math.sqrt(fluid.v[idx] ** 2 + fluid.u[idx] ** 2);
				const smoke = clamp(fluid.smoke[idx] * 2, 0, 1);
				color = getSciColor(p, minP, maxP);
				for (let k = 0; k < 3; k++) {
					color[k] *= smoke;
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

	ctx.putImageData(data, 0, 0);
}

function fluidText(fluid: Fluid) {
	const centerY = Math.floor(fluid.numY / 2) + 1;
	const start = Math.floor(fluid.numX / 5);
	let X = start;
	// F
	fluid.smokeRect(X, centerY - 20, 10, 40);
	fluid.smokeRect(X + 10, centerY + 10, 12, 10);
	fluid.smokeRect(X + 10, centerY - 5, 8, 8);
	X += 22 + 10;
	// L
	fluid.smokeRect(X, centerY - 20, 10, 40);
	fluid.smokeRect(X + 10, centerY - 20, 12, 10);
	X += 22 + 10;
	// U
	fluid.solidifyRect(X, centerY - 20, 10, 40);
	fluid.solidifyRect(X + 10, centerY - 20, 10, 10);
	fluid.solidifyRect(X + 20, centerY - 20, 10, 40);
	X += 30 + 10;
	// I
	fluid.smokeRect(X, centerY - 20, 10, 40);
	X += 10 + 10;

	// D
	fluid.smokeRect(X, centerY - 20, 10, 40);
	fluid.smokeRect(X + 10, centerY - 20, 12, 10);
	fluid.smokeRect(X + 10, centerY + 10, 12, 10);
	fluid.smokeRect(X + 15, centerY - 18, 10, 36);
	X += 15 + 10;
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
	const mousePos = (e: any) => {
		const rect = ctx.canvas.getBoundingClientRect();
		const x = Math.floor((e.clientX - rect.x) / scale);
		const y = Math.floor(Y - (e.clientY - rect.y) / scale);
		return { x, y };
	};
	const mouseFill = (x: number, y: number) => {
		for (let i = -3; i < 4; i++) {
			for (let j = -3; j < 4; j++) {
				const fx = x + i;
				const fy = y + j;
				const idx = fx * Y + fy;
				if (fx < 1 || fy < 1 || fx >= X || fy >= Y) {
					continue;
				}
				fluid.s[idx] = 0.0;
				fluid.smoke[idx] = 0.0;
			}
		}
	};
	const mouseHandler = (e: any) => {
		const { x, y } = mousePos(e);
		let dx = e.movementX / 6;
		let dy = e.movementY / 6;
		const speed = Math.sqrt(dx ** 2 + dy ** 2);
		if (speed > 4) {
			dx /= speed;
			dy /= speed;
		}
		if (e.buttons) {
			mouseFill(x, y);
		} else {
			for (let i = -4; i < 5; i++) {
				for (let j = -4; j < 5; j++) {
					const fx = x + i;
					const fy = y + j;
					const idx = fx * Y + fy;
					if (!fluid.s[idx] || fx <= 1 || fy <= 1 || fx >= X - 2 || fy >= Y - 2) {
						continue;
					}

					fluid.v[idx] = -dy;
					fluid.u[idx] = dx;
				}
			}
		}
	};
	ctx.canvas.addEventListener('mousemove', mouseHandler);
	ctx.canvas.addEventListener('click', (e) => {
		const { x, y } = mousePos(e);
		mouseFill(x, y);
	});
	for (let i = 0; i < X; i++) {
		for (let j = 0; j < Y; j++) {
			const idx = i * Y + j;
			let s = 1.0;
			const x = i / S;
			const y = j / S;
			const v = (x - 0.5) ** 2 + (y - 0.5) ** 2;
			if (j == 0 || j == Y - 1) {
				s = 0.0;
			}
			// if (i > 6 && Math.floor(j / 4 + 1) % 3 == 0 && Math.floor(i / 4) % 3 == 0) {
			// 	fluid.smoke[idx] = 1.0;
			// }
			fluid.s[idx] = s;
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
