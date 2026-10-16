"use client";

import { motion } from "framer-motion";
import AnimatedNumber from "@/components/AnimatedNumber";
import Icon, { type IconName } from "@/components/Icon";

export default function Kpi({
  value,
  label,
  decimals = 0,
  prefix = "",
  suffix = "",
  icon,
  hint,
}: {
  value: number;
  label: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  icon?: IconName;
  hint?: string;
}) {
  return (
    <motion.div
      className="card flex flex-col gap-3"
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--mut)]">{label}</span>
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--bg)] text-[var(--mut)]">
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <b className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">
        <AnimatedNumber value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </b>
      {hint && <span className="-mt-1 text-xs text-[var(--mut)]">{hint}</span>}
    </motion.div>
  );
}
