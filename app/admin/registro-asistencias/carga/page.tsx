import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import CargaDatos from "@/components/admin/asistencia-personal/carga/CargaDatos";

// CargaDatos lee ?tab= con useSearchParams: va dentro de un Suspense
export default function Page() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-96">
					<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
				</div>
			}
		>
			<CargaDatos />
		</Suspense>
	);
}
