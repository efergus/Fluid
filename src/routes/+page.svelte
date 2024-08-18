<script lang="ts">
	import { simulate } from '$lib/fluid.ts/fluid';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let step: () => void;
	let loop: (frames: number) => void;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			console.error('Failed to get context');
			return;
		}
		ctx.beginPath();
		ctx.arc(20, 20, 10, 0, 2 * Math.PI);
		ctx.fill();

		const { step: _step, loop: _loop } = simulate(ctx, 300, 200);
		step = _step;
		loop = _loop;
		// loop();
		// let idx = 0;
		// const update = () => {
		// 	step();
		// 	idx += 1;
		// 	if (idx < 60) {
		// 		requestAnimationFrame(update);
		// 	}
		// };
		// update();
	});
</script>

<div>
	<button on:click={step}>Step</button>
	<button on:click={() => loop(Infinity)}>Loop</button>
	<canvas bind:this={canvas}> </canvas>
</div>

<style>
	div {
		width: 100%;
		height: 100%;
	}
	canvas {
		width: 100%;
		/* height: 100%; */
	}
</style>
