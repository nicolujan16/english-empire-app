import { useState } from "react";
import defaultStaffPic from "@/assets/adminPage/default_staff_pic.png";
import Image, { StaticImageData } from "next/image";

export default function ProfesorCard({
	name,
	role,
	imgUrl,
}: {
	name: string;
	role: string;
	imgUrl: string | StaticImageData;
}) {
	const [imgSrc, setImgSrc] = useState<string | StaticImageData>(imgUrl);

	return (
		<div className="flex flex-col flex-shrink-0 justify-center items-center gap-3 w-[240px] min-w-[240px] md:min-w-[20%] text-center">
			{/* IMAGEN DE PERFIL */}
			<Image
				src={imgSrc}
				alt={`Foto de ${name} - ${role}`}
				width={200}
				height={200}
				onError={() => setImgSrc(defaultStaffPic)}
				unoptimized
				className="
          object-cover 
          rounded-full 
          border-4 border-[#252d62]
          shadow-md
        "
			/>

			{/* INFORMACIÓN */}
			<div className="flex flex-col text-[1.2rem] text-[#252d62]">
				<p className="font-bold">{name}</p>
				<p className="font-normal opacity-90">{role}</p>
			</div>
		</div>
	);
}
