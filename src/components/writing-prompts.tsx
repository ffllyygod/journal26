'use client';

import { useState } from 'react';
import { writingPrompt, writingPromptCategories } from '@/lib/writing-prompts';

type WritingPromptsProps = {
  date: string;
  onChoose: () => void;
  descriptionId: string;
};

export function WritingPrompts(props: WritingPromptsProps) {
  return <PromptChoices key={props.date} {...props} />;
}

function PromptChoices({ date, onChoose, descriptionId }: WritingPromptsProps) {
  const [category, setCategory] = useState(0);
  const [advances, setAdvances] = useState(() => writingPromptCategories.map(() => 0));

  return (
    <div className="journal-prompts">
      <p className="microcopy">Need a starting point? Pick a prompt, or write your own way.</p>
      <div className="prompt-options" role="group" aria-label="Writing prompts">
        {writingPromptCategories.map((item, index) => (
          <button
            type="button"
            key={item.label}
            aria-pressed={category === index}
            onClick={() => {
              setCategory(index);
              onChoose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p id={descriptionId} className="prompt-question" aria-live="polite">
        {writingPrompt(date, category, advances[category])}
      </p>
      <div className="prompt-options">
        <button
          type="button"
          onClick={() => {
            setAdvances(current => current.map((value, index) => (index === category ? value + 1 : value)));
            onChoose();
          }}
        >
          Another prompt
        </button>
      </div>
    </div>
  );
}
