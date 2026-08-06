import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<Record<string, unknown>>;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent",
  };

  const animationVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: position === "top" ? 4 : position === "bottom" ? -4 : 0,
      x: position === "left" ? 4 : position === "right" ? -4 : 0,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 25,
      },
    },
  };

  // Clone the child element to attach event handlers automatically
  const childProps = children.props as Record<string, unknown>;
  const child = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      if (typeof childProps.onMouseEnter === "function") {
        (childProps.onMouseEnter as (ev: React.MouseEvent) => void)(e);
      }
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      if (typeof childProps.onMouseLeave === "function") {
        (childProps.onMouseLeave as (ev: React.MouseEvent) => void)(e);
      }
    },
    onFocus: (e: React.FocusEvent) => {
      setIsVisible(true);
      if (typeof childProps.onFocus === "function") {
        (childProps.onFocus as (ev: React.FocusEvent) => void)(e);
      }
    },
    onBlur: (e: React.FocusEvent) => {
      setIsVisible(false);
      if (typeof childProps.onBlur === "function") {
        (childProps.onBlur as (ev: React.FocusEvent) => void)(e);
      }
    },
  });

  return (
    <div className="relative inline-block" id="tooltip-container">
      {child}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={animationVariants}
            className={`absolute z-50 pointer-events-none ${positionClasses[position]}`}
            id="tooltip-bubble"
          >
            <div className="relative bg-slate-900 border border-slate-800 text-slate-100 px-2 py-1.5 rounded-md text-[11px] font-medium tracking-wide shadow-2xl whitespace-nowrap">
              {content}
              <div className={`absolute border-[4px] ${arrowClasses[position]}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
