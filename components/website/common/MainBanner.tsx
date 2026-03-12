import React from "react";

export function MainBanner({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="
        /* Layout y Posicionamiento */
        relative flex flex-col justify-center items-center 
        w-[90%] min-h-[10rem] mx-auto 
        p-14 
        
        /* Estilos Visuales */
        bg-[#252653] 
        rounded-b-[40px]
        
        /* Tipografía Base */
        text-white text-[3rem]
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
