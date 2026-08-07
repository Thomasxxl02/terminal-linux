import { Clock, CheckCircle2, Activity } from "lucide-react";

interface PlaybookStepView {
  id: string;
  title: string;
  description?: string;
  command: string;
  delaySeconds?: number;
  stopOnError?: boolean;
}

interface PlaybookStepsViewProps {
  playbook: { steps: PlaybookStepView[] };
  stepStatuses: Record<string, "pending" | "running" | "success" | "failed">;
  runningStepIndex: number | null;
}

/** Séquenceur visuel des étapes d'un playbook (statut, délai, commande). */
export function PlaybookStepsView({
  playbook,
  stepStatuses,
  runningStepIndex,
}: PlaybookStepsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1 custom-scrollbar">
      {playbook.steps.map((step, idx) => {
        const status = stepStatuses[step.id] || "pending";
        const isCurrent = runningStepIndex === idx;

        return (
          <div
            key={step.id}
            className={`p-3 rounded-lg border font-mono text-xs transition-all relative ${
              isCurrent
                ? "bg-teal-500/5 border-teal-500/40 text-teal-200"
                : status === "success"
                ? "bg-slate-950/20 border-emerald-500/25 text-slate-300"
                : "bg-slate-950/40 border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="text-[10px] text-teal-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                    Étape {idx + 1}
                  </span>
                  {step.title}
                </h4>
                {step.description && (
                  <p className="text-[11px] text-slate-400 italic font-normal">
                    {step.description}
                  </p>
                )}
                <div className="bg-slate-950 p-2 rounded border border-slate-900 font-mono text-[10.5px] text-teal-300 mt-2 whitespace-pre-wrap select-all">
                  {step.command}
                </div>
              </div>

              {/* Status badge Indicator */}
              <div className="shrink-0 flex items-center gap-1 text-[10px] font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{step.delaySeconds || 1}s</span>

                <div className="ml-2 shrink-0">
                  {status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : status === "running" ? (
                    <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700" />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
