import { Vec2, vec2 } from './vec2';

function clamp(val: number, lower: number, higher: number) {
	return Math.max(lower, Math.min(val, higher));
}

type FieldOptions = {
	size?: Vec2;
	origin?: Vec2;
};

export class Field {
	declare arr: Float32Array;
	declare X: number;
	declare Y: number;
	declare origin: Vec2;
	declare size: Vec2;

	constructor(X: number, Y: number, options: FieldOptions = {}) {
		const { size, origin } = options;
		this.X = X;
		this.Y = Y;
		this.size = size?.clone() ?? vec2(X, Y);
		this.origin = origin?.clone() ?? vec2();
		this.arr = new Float32Array(X * Y);
	}

	idx(i: number, j: number) {
		i = clamp(i, 0, this.X - 1);
		j = clamp(j, 0, this.Y - 1);
		return j * this.X + i;
	}

	get(i: number, j: number) {
		return this.arr[this.idx(i, j)];
	}

	set(i: number, j: number, val: number) {
		this.arr[this.idx(i, j)] = val;
	}

	add(i: number, j: number, val: number) {
		this.arr[this.idx(i, j)] = val;
	}

	fill(val: number) {
		this.arr.fill(val);
	}

	local(x: number, y: number) {
		x = (x - this.origin.x) / this.size.x;
		y = (y - this.origin.y) / this.size.y;
		return vec2(clamp(x, 0, 1), clamp(y, 0, 1));
	}

	sample(x: number, y: number) {
		const pos = this.local(x, y);
		const i = Math.floor(pos.x);
		const j = Math.floor(pos.y);
		const dx = pos.x - i;
		const dy = pos.y - j;
		const sx = 1 - dx;
		const sy = 1 - dy;
		const val =
			sx * sy * this.get(i, j) +
			dx * sy * this.get(i + 1, j) +
			sx * dy * this.get(i, j + 1) +
			dx * dy * this.get(i + 1, j + 1);
		return val;
	}

	interior(fn: (i: number, j: number, x: number, y: number) => void) {
		for (let i = 1; i < this.X - 1; i++) {
			for (let j = 1; j < this.Y - 1; j++) {
				const x = this.origin.x + (i * this.size.x) / this.X;
				const y = this.origin.y + (j * this.size.y) / this.Y;
				fn(i, j, x, y);
			}
		}
	}
}
