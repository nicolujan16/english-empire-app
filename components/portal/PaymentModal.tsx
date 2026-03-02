"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PaymentModalProps {
	isOpen: boolean;
	message: string;
}

const PaymentModal = ({ isOpen, message }: PaymentModalProps) => {
	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<div className="fixed inset-0 flex items-center justify-center z-50 p-4">
						<motion.div
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							transition={{ duration: 0.3 }}
							className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
						>
							<div className="flex flex-col items-center text-center">
								{/* Spinner */}
								<motion.div
									animate={{ rotate: 360 }}
									transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
									className="mb-6"
								>
									<Loader2 className="w-16 h-16 text-[#2a2e5b]" />
								</motion.div>

								{/* Message */}
								<h3 className="text-2xl font-bold text-[#2a2e5b] mb-2">
									{message}
								</h3>
								<p className="text-gray-600">
									Por favor, no cierres esta ventana
								</p>

								{/* Loading Bar */}
								<div className="w-full bg-gray-200 rounded-full h-2 mt-6 overflow-hidden">
									<motion.div
										initial={{ width: "0%" }}
										animate={{ width: "100%" }}
										transition={{ duration: 2, ease: "easeInOut" }}
										className="h-full bg-gradient-to-r from-[#2a2e5b] to-[#e63946] rounded-full"
									/>
								</div>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	);
};

export default PaymentModal;
