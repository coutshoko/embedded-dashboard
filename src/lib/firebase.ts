import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { readable } from 'svelte/store';

const firebaseConfig = {
	databaseURL: 'https://pluh-f5b51-default-rtdb.asia-southeast1.firebasedatabase.app'
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export interface SensorData {
	humidity: number;
	ir_object: number;
	led: number;
	motion: number;
	temperature: number;
	// New sound-related fields
	sound_detect?: number;
	sound_volt?: number;
	// New ambient light (0/1)
	light?: number;
}

export const sensorData = readable<SensorData | null>(null, (set) => {
	const sensorRef = ref(database, 'sensor');

	const unsubscribe = onValue(sensorRef, (snapshot) => {
		const data = snapshot.val();
		if (data) {
			set(data as SensorData);
		}
	});

	return () => {
		unsubscribe();
	};
});

export const setLed = (status: number) => {
	const ledRef = ref(database, 'sensor/led');
	set(ledRef, status);
};
