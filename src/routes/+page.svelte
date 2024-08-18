<script lang="ts">
	import { simulate } from '$lib/fluid.ts/fluid';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			console.error('Failed to get context');
			return;
		}
		ctx.beginPath();
		ctx.arc(20, 20, 10, 0, 2 * Math.PI);
		ctx.fill();

		const scale = 4;
		const width = Math.floor(window.innerWidth / scale);
		const height = Math.floor(window.innerHeight / scale);
		const { loop } = simulate(ctx, width, height, scale);
		loop(Infinity);
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
	<canvas bind:this={canvas}> </canvas>
</div>

<style>
	div {
		width: 100%;
		height: 100%;
	}
</style>
