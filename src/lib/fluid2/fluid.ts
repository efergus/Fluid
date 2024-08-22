import { Field } from './field';
import { vec2 } from './vec2';

type FluidOptions = {
	overrelaxation?: number;
};

class Fluid {
	declare vx: Field;
	declare vy: Field;
	declare prevx: Field;
	declare prevy: Field;
	declare pressure: Field;
	declare open: Field;
	declare smoke: Field;
	declare overrelaxation: number;

	constructor(X: number, Y: number, options: FluidOptions = {}) {
		const { overrelaxation = 1.9 } = options;
		this.vx = new Field(X, Y, { origin: vec2(-0.5, 0) });
		this.vy = new Field(X, Y, { origin: vec2(0, -0.5) });
		this.prevx = new Field(X, Y, { origin: vec2(0.5, 0) });
		this.prevy = new Field(X, Y, { origin: vec2(0, 0.5) });
		this.pressure = new Field(X, Y);
		this.open = new Field(X, Y);
		this.smoke = new Field(X, Y);
		this.overrelaxation = overrelaxation;
	}

	swap() {
		const tmpx = this.vx;
		const tmpy = this.vy;

		this.vx = this.prevx;
		this.vy = this.prevy;
		this.prevx = tmpx;
		this.prevy = tmpy;
	}

	constrain(dt: number) {
		this.swap();

		this.vx.interior((i, j) => {
			const sx0 = this.open.get(i - 1, j);
			const sx1 = this.open.get(i + 1, j);
			const sy0 = this.open.get(i, j - 1);
			const sy1 = this.open.get(i, j + 1);
			const open = sx0 + sx1 + sy0 + sy1;
			if (!open) {
				return;
			}

			const vx0 = this.prevx.get(i, j);
			const vx1 = this.prevx.get(i + 1, j);
			const vy0 = this.prevy.get(i, j);
			const vy1 = this.prevy.get(i, j + 1);

			const divergence = vx1 - vx0 + vy1 - vy0;
			const correction = (-divergence / open) * this.overrelaxation;
			this.pressure.add(i, j, correction / dt);

			this.vx.add(i, j, sx0 * correction);
			this.vx.add(i + 1, j, sx1 * correction);
			this.vy.add(i, j, sy0 + correction);
			this.vy.add(i, j + 1, sy1 + correction);
		});
	}

	advectVel(dt: number) {
		this.swap();
		this.vx.interior((i, j, x, y) => {
			// TODO: maybe need an additional check?
			if (!this.open.get(i, j)) {
				return;
			}
			const dx = this.prevx.get(i, j) * dt;
			const dy = this.prevy.sample(x, y) * dt;
			const vx = this.prevx.sample(x - dx, y - dy);
			this.vx.set(i, j, vx);
		});
		this.vy.interior((i, j, x, y) => {
			// TODO: maybe need an additional check?
			if (!this.open.get(i, j)) {
				return;
			}
			const dx = this.prevx.sample(x, y) * dt;
			const dy = this.prevy.get(i, j) * dt;
			const vy = this.prevy.sample(x - dx, y - dy);
			this.vy.set(i, j, vy);
		});
	}

	step(dt: number) {
		this.constrain(dt);
		this.advectVel(dt);
	}
}

type DrawContext = {
	ctx: CanvasRenderingContext2D;
	minP: number;
	maxP: number;
	fluid: Fluid;
};

function draw(context: DrawContext) {}

function simulate(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	scale = 4.0,
	steps = 40,
) {
	const fluid = new Fluid(width, height);
	const X = width;
	const Y = height;

	ctx.canvas.width = X * scale;
	ctx.canvas.height = Y * scale;
	ctx.canvas.style.width = `${X * scale}px`;
	ctx.canvas.style.height = `${Y * scale}px`;

	const update = () => {
		for (let i = 0; i < steps; i++) {
			fluid.step(1 / 60 / steps);
		}
		// draw();
		requestAnimationFrame(update);
	};
}
