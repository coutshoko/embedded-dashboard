<script lang="ts">
	import { sensorData, setLed } from '$lib/firebase';
	import { onDestroy } from 'svelte';

	$: data = $sensorData;
	
	let sleepMode = false;
	let sleepTimer: NodeJS.Timeout | null = null;
	let vacantTimer: NodeJS.Timeout | null = null;
	let previousIr: number | undefined = undefined;
	let soundToggleCooldown = false;

	const voltToDb = (voltage: number): number => {
        if (!voltage || voltage <= 0) return 0;
        let db = 20 * Math.log10(voltage) + 40; 
        return db < 0 ? 0 : db; 
    };

	// Reactive statement to handle all automation logic
	$: handleAutomation(data?.ir_object, data?.motion, data?.led, data?.sound_volt);

	function handleAutomation(ir: number | undefined, motion: number | undefined, led: number | undefined, sound_volt: number | undefined) {
		// 1. ENTRY LOGIC: Auto-On when entering (IR 0 -> 1)
		if (previousIr === 0 && ir === 1) {
			if (led === 0) {
				setLed(1);
			}
			// Cancel vacancy timer if someone enters
			if (vacantTimer) {
				clearTimeout(vacantTimer);
				vacantTimer = null;
			}
		}
		previousIr = ir;

		// 4. SOUND TOGGLE LOGIC: Toggle LED if sound > 100dB
		if (sound_volt) {
			const db = voltToDb(sound_volt);
			if (db > 95 && !soundToggleCooldown) {
				setLed(led === 1 ? 0 : 1);
				
				// Set cooldown for 2 seconds to prevent flickering
				soundToggleCooldown = true;
				setTimeout(() => {
					soundToggleCooldown = false;
				}, 2000);
			}
		}

		// 2. VACANCY LOGIC: Auto-Off if empty (IR=0) for 3 mins
		if (ir === 0) {
			if (!vacantTimer) {
				vacantTimer = setTimeout(() => {
					if (led === 1) setLed(0);
					vacantTimer = null;
				}, 5000);
			}
		} else {
			// If not vacant, clear vacancy timer
			if (vacantTimer) {
				clearTimeout(vacantTimer);
				vacantTimer = null;
			}
		}

		// 3. SLEEP LOGIC: Occupied (IR=1) but No Motion (Motion=0)
		if (ir === 1 && motion === 0) {
			if (!sleepTimer) {
				sleepTimer = setTimeout(() => {
					sleepMode = true;
					if (led === 1) setLed(0);
				}, 5000);
			}
		} else {
			// Reset sleep mode/timer if motion detected or vacant
			if (sleepTimer) {
				clearTimeout(sleepTimer);
				sleepTimer = null;
			}
			if (sleepMode) {
				sleepMode = false; // Just wake up UI, don't auto-on light
			}
		}
	}

	onDestroy(() => {
		if (sleepTimer) clearTimeout(sleepTimer);
		if (vacantTimer) clearTimeout(vacantTimer);
	});



</script>

<svelte:head>
	<title>Smart Table</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="dashboard" class:light={data?.led === 1} class:sleep={sleepMode}>
	<div class="content">
		<!-- Header -->
		<header class="header">
			<h1>Smart 	Table<title>Smart </title></h1>
			<div class="status-badge" class:connected={data}>
				<span class="status-dot"></span>
				{data ? 'Live' : 'Connecting...'}
			</div>
		</header>

		<!-- Stats Grid -->
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-label">Temperature</span>
				<span class="stat-value">{data?.temperature ?? '--'}°C</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Humidity</span>
				<span class="stat-value">{data?.humidity ?? '--'}%</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Motion</span>
				<span class="stat-value" class:active={data?.motion === 1}
					>{data?.motion === 1 ? 'Detected' : 'None'}</span
				>
			</div>
			<div class="stat-card">
				<span class="stat-label">LED</span>
				<span class="stat-value" class:led-on={data?.led === 1}
					>{data?.led === 1 ? 'On' : 'Off'}</span
				>
			</div>
			<div class="stat-card">
				<span class="stat-label">Light</span>
				<span class="stat-value">{data?.light ?? '--'}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Sound</span>
				<span class="stat-value" class:active={data?.sound_detect === 1}
					>{data?.sound_detect === 1 ? 'Detected' : 'None'}</span
				>
			</div>
			<div class="stat-card">
				<span class="stat-label">Sound Level</span>
				<span class="stat-value">
					{data?.sound_volt ? voltToDb(data.sound_volt).toFixed(1) : '--'} dB
				</span>
			</div>
		</div>

		<!-- Visualization -->
		<div class="visualization-card">
			<div class="vis-header">
				<h2>Workspace View</h2>
				<span class="occupancy-tag" class:occupied={data?.ir_object === 1}>
					{data?.ir_object === 1 ? 'Occupied' : 'Vacant'}
				</span>
			</div>

			<svg viewBox="0 0 400 260" class="workspace-svg">
				<defs>
					<linearGradient id="roomGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" style="stop-color:#0b1220" />
						<stop offset="100%" style="stop-color:#1f1545" />
					</linearGradient>
					<linearGradient id="roomGradLight" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" style="stop-color:#fef3c7" />
						<stop offset="100%" style="stop-color:#fde68a" />
					</linearGradient>
					<linearGradient id="deskGrad" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" style="stop-color:#f59e0b" />
						<stop offset="100%" style="stop-color:#d97706" />
					</linearGradient>
					<linearGradient id="lampOn" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" style="stop-color:#fbbf24" />
						<stop offset="100%" style="stop-color:#f59e0b" />
					</linearGradient>
				</defs>

				<!-- Room -->
				<rect
					x="20"
					y="10"
					width="360"
					height="240"
					rx="12"
					fill={data?.led === 1 ? 'url(#roomGradLight)' : 'url(#roomGradDark)'}
				/>

				<!-- Floor -->
				<rect
					x="20"
					y="190"
					width="360"
					height="60"
					rx="0 0 12 12"
					fill={data?.led === 1 ? '#cbd5e1' : '#0f172a'}
				/>

				<!-- Lamp -->
				<line x1="200" y1="10" x2="200" y2="40" stroke="#6b7280" stroke-width="2" />
				<ellipse
					cx="200"
					cy="48"
					rx="30"
					ry="12"
					fill={data?.led === 1 ? 'url(#lampOn)' : '#4b5563'}
				/>
				{#if data?.led === 1}
					<path d="M170 55 L140 160 L260 160 L230 55 Z" fill="#fbbf24" opacity="0.15" />
				{/if}

				<!-- Desk -->
				<rect x="90" y="155" width="220" height="12" rx="2" fill="url(#deskGrad)" />
				<rect x="105" y="167" width="8" height="40" fill="#5c4033" />
				<rect x="287" y="167" width="8" height="40" fill="#5c4033" />

				<!-- Monitor -->
				<rect
					x="170"
					y="115"
					width="60"
					height="40"
					rx="4"
					fill="#1f2937"
					stroke="#374151"
					stroke-width="2"
				/>
				<rect
					x="175"
					y="120"
					width="50"
					height="30"
					rx="2"
					fill={data?.led === 1 ? '#60a5fa' : '#374151'}
				/>
				<rect x="195" y="155" width="10" height="8" fill="#374151" />

				<!-- Chair -->
				<rect x="178" y="180" width="44" height="8" rx="4" fill="#6366f1" />
				<line
					x1="188"
					y1="188"
					x2="183"
					y2="210"
					stroke="#4f46e5"
					stroke-width="4"
					stroke-linecap="round"
				/>
				<line
					x1="212"
					y1="188"
					x2="217"
					y2="210"
					stroke="#4f46e5"
					stroke-width="4"
					stroke-linecap="round"
				/>
				<circle cx="181" cy="213" r="4" fill="#374151" />
				<circle cx="219" cy="213" r="4" fill="#374151" />

				<!-- Person -->
				{#if data?.ir_object === 1}
					<circle cx="200" cy="120" r="25" fill="#a78bfa" />
					<rect x="183" y="145" width="34" height="35" rx="6" fill="#818cf8" />
				{:else}
					<text
						x="200"
						y="135"
						text-anchor="middle"
						fill="#6b7280"
						font-size="12"
						font-family="Inter, sans-serif"
					>
						<!-- Empty -->
					</text>
				{/if}

				{#if sleepMode}
					<text
						x="250"
						y="100"
						font-family="Inter"
						font-weight="bold"
						fill="#fff"
						font-size="24"
						opacity="0.8"
					>
						<animate
							attributeName="opacity"
							values="0.8;0.2;0.8"
							dur="2s"
							repeatCount="indefinite"
						/>
						Zzz...
					</text>
				{/if}
			</svg>
		</div>
	</div>
</div>

<style>
	:global(body) {
		font-family: 'Inter', sans-serif;
		margin: 0;
		padding: 0;
	}

	.dashboard {
		min-height: 100vh;
		background: radial-gradient(1200px 600px at 10% 10%, rgba(14,165,233,0.25) 0%, rgba(14,165,233,0) 40%),
				linear-gradient(135deg, #0b1220 0%, #111827 45%, #1f1545 70%, #3b0a2a 100%);
		padding: 2rem;
		transition: background 0.5s ease;
	}

	/* Sleep Mode Styles */
	.dashboard.sleep {
		filter: brightness(0.6);
	}
	.dashboard.sleep .status-badge {
		opacity: 0.5;
	}

	.stat-value.warning {
			color: #ef4444; /* สีแดง */
			text-shadow: 0 0 10px rgba(239, 68, 68, 0.5); /* เพิ่ม Glow */
		}
		
	.dashboard.light {
		background: linear-gradient(135deg, #a7f3d0 0%, #fde68a 50%, #fbcfe8 100%);
	}
	.dashboard.light .stat-value.warning {
			color: #dc2626; /* สีแดงเข้มสำหรับธีมสว่าง */
		}
	.content {
		max-width: 800px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: white;
		margin: 0;
		transition: color 0.5s ease;
	}

	.dashboard.light .header h1 {
		color: #1e293b;
	}

	.status-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 50px;
		font-size: 0.8rem;
		font-weight: 600;
		background: rgba(59, 130, 246, 0.25);
		color: #e0f2fe;
		border: 1px solid rgba(59, 130, 246, 0.35);
		transition: all 0.5s ease;
	}

	.dashboard.light .status-badge {
		background: rgba(0, 0, 0, 0.1);
		color: #1e293b;
	}

	.status-badge.connected {
		background: rgba(34, 197, 94, 0.5);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: rgba(255, 255, 255, 0.18);
		box-shadow: 0 8px 24px rgba(14, 165, 233, 0.08);
		backdrop-filter: blur(12px);
		border-radius: 16px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: background 0.5s ease, box-shadow 0.5s ease;
		min-width: 0; /* allow grid to shrink without content forcing width */
		align-items: center; /* center horizontally (flex column) */
		text-align: center; /* center text */
	}

	.dashboard.light .stat-card {
		background: rgba(255, 255, 255, 0.7);
	}

	.stat-label {
		font-size: clamp(0.6rem, 1.1vw, 0.7rem);
		color: rgba(190, 228, 255, 0.8);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transition: color 0.5s ease;
	}

	.dashboard.light .stat-label {
		color: rgba(30, 41, 59, 0.7);
	}

	.stat-value {
		font-size: clamp(0.9rem, 2.2vw, 1.35rem);
		font-weight: 700;
		color: #f5f3ff;
		transition: color 0.5s ease;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dashboard.light .stat-value {
		color: #111827;
	}

	.stat-value.active {
		color: #86efac;
	}

	.dashboard.light .stat-value.active {
		color: #16a34a;
	}

	.stat-value.led-on {
		color: #fde047;
	}

	.dashboard.light .stat-value.led-on {
		color: #d97706;
	}

	.visualization-card {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		border-radius: 20px;
		padding: 1.5rem;
		transition: background 0.5s ease;
	}

	.dashboard.light .visualization-card {
		background: rgba(0, 0, 0, 0.08);
	}

	.vis-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.vis-header h2 {
		font-size: 1rem;
		font-weight: 600;
		color: white;
		margin: 0;
		transition: color 0.5s ease;
	}

	.dashboard.light .vis-header h2 {
		color: #1e293b;
	}

	.occupancy-tag {
		padding: 0.375rem 0.875rem;
		border-radius: 50px;
		font-size: 0.75rem;
		font-weight: 600;
		background: rgba(244, 63, 94, 0.25);
		color: #fff;
		border: 1px solid rgba(244, 63, 94, 0.4);
	}

	.occupancy-tag.occupied {
		background: rgba(34, 197, 94, 0.25);
		color: #fff;
		border: 1px solid rgba(34, 197, 94, 0.4);
	}

	.dashboard.light .occupancy-tag {
		background: rgba(244, 63, 94, 0.2);
		color: #b91c1c;
		border-color: rgba(244, 63, 94, 0.35);
	}

	.dashboard.light .occupancy-tag.occupied {
		background: rgba(34, 197, 94, 0.2);
		color: #166534;
		border-color: rgba(34, 197, 94, 0.35);
	}

	.workspace-svg {
		width: 100%;
		height: auto;
		border-radius: 12px;
	}
</style>
