import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
	icon: LucideIcon;
	label: string;
	value: string | number;
	trend: string;
}

const MetricsCard = ({ icon: Icon, label, value, trend }: MetricsCardProps) => {
	return (
		<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
			<div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
				<Icon className="w-6 h-6 text-[#252d62]" />
			</div>
			<div>
				<p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
				<h3 className="text-2xl font-bold text-[#252d62]">{value}</h3>
				<p className="text-xs text-green-600 font-medium mt-1">{trend}</p>
			</div>
		</div>
	);
};

export default MetricsCard;
