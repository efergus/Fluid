<script lang="ts">
	import { simulate } from '$lib/fluid/fluid';
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

		const res = 180;
		let width = window.innerWidth;
		let height = window.innerHeight;
		const scale = Math.ceil(Math.min(width, height) / res);
		width = Math.floor(width / scale);
		height = Math.floor(height / scale);
		const { loop } = simulate(ctx, width, height, scale);
		loop(Infinity);
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
