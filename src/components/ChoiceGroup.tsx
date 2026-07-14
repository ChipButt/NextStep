import { useState } from "react";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { Button } from "./Button";

export type Choice<T extends string | number = string> = {
  label: string;
  value: T;
  description?: string;
};

type ChoiceGroupProps<T extends string | number> = {
  choices: Choice<T>[];
  onChoose: (value: T) => void;
  maxVisible?: number;
};

export function ChoiceGroup<T extends string | number>({ choices, onChoose, maxVisible = 5 }: ChoiceGroupProps<T>) {
  const [page, setPage] = useState(0);
  const actualMax = Math.max(2, maxVisible);
  const showPager = choices.length > actualMax;
  const pageSize = showPager ? actualMax - 1 : actualMax;
  const totalPages = Math.ceil(choices.length / pageSize);
  const visible = choices.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="choice-stack" role="list">
      {visible.map((choice) => (
        <Button key={String(choice.value)} variant="secondary" onClick={() => onChoose(choice.value)}>
          <span className="choice-label">{choice.label}</span>
          {choice.description ? <span className="choice-description">{choice.description}</span> : null}
        </Button>
      ))}
      {showPager && page < totalPages - 1 ? (
        <Button variant="quiet" icon={<MoreHorizontal size={19} />} onClick={() => setPage((current) => current + 1)}>
          More options
        </Button>
      ) : null}
      {showPager && page > 0 ? (
        <Button variant="quiet" icon={<ChevronLeft size={18} />} onClick={() => setPage((current) => current - 1)}>
          Back
        </Button>
      ) : null}
    </div>
  );
}
