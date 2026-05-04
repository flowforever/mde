export interface InlineFlowchartTargets {
  readonly hasCodeBlocks: boolean;
  readonly targets: readonly InlineFlowchartTarget[];
}

export interface InlineFlowchartTarget {
  readonly blockIndex: number;
  readonly element: HTMLElement;
}

export const areSameInlineFlowchartTargets = (
  first: readonly InlineFlowchartTarget[],
  second: readonly InlineFlowchartTarget[],
): boolean =>
  first.length === second.length &&
  first.every(
    (target, index) =>
      target.blockIndex === second[index].blockIndex &&
      target.element === second[index].element,
  );

export const getNextMissingInlineFlowchartTargets = (
  currentTargets: InlineFlowchartTargets | null,
  hasCodeBlocks: boolean,
): InlineFlowchartTargets =>
  currentTargets?.hasCodeBlocks === hasCodeBlocks &&
  currentTargets.targets.length === 0
    ? currentTargets
    : {
        hasCodeBlocks,
        targets: [],
      };
