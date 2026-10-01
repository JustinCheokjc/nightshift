"use client";

import { motion } from "framer-motion";
import AnimatedNumber from "@/components/AnimatedNumber";

export default function Kpi({
  value,
  label,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  label: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <b className="block text-2xl leading-tight">
        <AnimatedNumber value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </b>
      <span className="text-xs text-[var(--mut)]">{label}</span>
    </motion.div>
  );
}
