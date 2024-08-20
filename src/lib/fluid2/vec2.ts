export class Vec2 {
	declare x: number;
	declare y: number;

	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	clone(): Vec2 {
		return new Vec2(this.x, this.y);
	}
}

export function vec2(x = 0, y = 0) {
	return new Vec2(x, y);
}
