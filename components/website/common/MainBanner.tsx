import React from "react";

export function MainBanner({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="
        /* Layout y Posicionamiento */
        relative flex flex-col justify-center items-center 
        w-[90%] min-h-[14rem] mx-auto 
        p-14 /* 3.5rem = 14 en Tailwind (14 * 0.25rem) */
        
        /* Estilos Visuales */
        bg-[#252653] 
        rounded-b-[40px]
        
        /* Tipografía Base */
        text-white text-[3rem] /* 3rem fijo como tenías */
      "
		>
			{/* TEXTO DEL BANNER */}
			<p className="text-center pb-3 z-10 relative">{children}</p>

			{/* BARRA DECORATIVA INFERIOR */}
			<div
				className="
          absolute bottom-0 w-full h-14 
          rounded-b-[40px] 
          bg-[#252d62] 
          border-t-2 border-[red] /* Ojo: Si quieres el rojo de la marca usa border-[#EE1120] */
        "
			></div>
		</div>
	);
}
