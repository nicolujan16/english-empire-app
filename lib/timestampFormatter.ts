export function timestampFormatter(
	timestamp: number | Date | { toDate: () => Date },
): string {
	let date: Date;

	if (timestamp instanceof Date) {
		date = timestamp;
	} else if (typeof timestamp === "number") {
		// Detecta si viene en segundos o milisegundos
		date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
	} else if (typeof timestamp === "object" && "toDate" in timestamp) {
		date = timestamp.toDate();
	} else {
		throw new Error("Formato de timestamp inválido");
	}

	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();

	return `${day}-${month}-${year}`;
}
