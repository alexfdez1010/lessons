/**
 * Barrel for the Lessons React islands.
 *
 * Import components and their prop/option types from a single path:
 * @example
 *   import { MCQ, Quiz, type MCQProps, type QuizProps } from '@/components/react';
 */

export { cx } from '@/components/react/cx';

export { MCQ, default as MCQDefault } from '@/components/react/MCQ';
export type { MCQProps, MCQOption } from '@/components/react/MCQ';

export { Quiz, default as QuizDefault } from '@/components/react/Quiz';
export type { QuizProps } from '@/components/react/Quiz';

export { FinalExam, default as FinalExamDefault } from '@/components/react/FinalExam';
export type { FinalExamProps, FinalExamQuestion } from '@/components/react/FinalExam';

export { Reveal, default as RevealDefault } from '@/components/react/Reveal';
export type { RevealProps } from '@/components/react/Reveal';

export { Callout, default as CalloutDefault } from '@/components/react/Callout';
export type { CalloutProps, CalloutVariant } from '@/components/react/Callout';

export { LedgerReveal, default as LedgerRevealDefault } from '@/components/react/LedgerReveal';
export type { LedgerRevealProps, LedgerField } from '@/components/react/LedgerReveal';

export { MatchConcepts, default as MatchConceptsDefault } from '@/components/react/MatchConcepts';
export type { MatchConceptsProps, MatchPair } from '@/components/react/MatchConcepts';

export { PrivacyDial, default as PrivacyDialDefault } from '@/components/react/PrivacyDial';
export type { PrivacyDialProps } from '@/components/react/PrivacyDial';

export { MindMap, default as MindMapDefault } from '@/components/react/MindMap';
export type { MindMapProps, MindNode } from '@/components/react/MindMap';

export { RiskReturnRace, default as RiskReturnRaceDefault } from '@/components/react/RiskReturnRace';
export type { RiskReturnRaceProps } from '@/components/react/RiskReturnRace';

export { CompoundingCurve, default as CompoundingCurveDefault } from '@/components/react/CompoundingCurve';
export type { CompoundingCurveProps } from '@/components/react/CompoundingCurve';

export { DrawdownChart, default as DrawdownChartDefault } from '@/components/react/DrawdownChart';
export type { DrawdownChartProps } from '@/components/react/DrawdownChart';

export { ReturnDistribution, default as ReturnDistributionDefault } from '@/components/react/ReturnDistribution';
export type { ReturnDistributionProps } from '@/components/react/ReturnDistribution';

export { BetaScatter, default as BetaScatterDefault } from '@/components/react/BetaScatter';
export type { BetaScatterProps } from '@/components/react/BetaScatter';

export { Categorize, default as CategorizeDefault } from '@/components/react/Categorize';
export type { CategorizeProps, CategorizeItem } from '@/components/react/Categorize';

export { FillBlank, default as FillBlankDefault } from '@/components/react/FillBlank';
export type { FillBlankProps } from '@/components/react/FillBlank';

export { PresentValueDecay, default as PresentValueDecayDefault } from '@/components/react/PresentValueDecay';
export type { PresentValueDecayProps } from '@/components/react/PresentValueDecay';

export { CourseGraph, default as CourseGraphDefault } from '@/components/react/CourseGraph';
export type { CourseGraphProps, CourseNode, Difficulty } from '@/components/react/CourseGraph';

export { CourseComplete, default as CourseCompleteDefault } from '@/components/react/CourseComplete';
export type { CourseCompleteProps } from '@/components/react/CourseComplete';

export { BlockchainChain, default as BlockchainChainDefault } from '@/components/react/BlockchainChain';
export type { BlockchainChainProps } from '@/components/react/BlockchainChain';

export { KeyPairSign, default as KeyPairSignDefault } from '@/components/react/KeyPairSign';
export type { KeyPairSignProps } from '@/components/react/KeyPairSign';

export { MempoolFeeMarket, default as MempoolFeeMarketDefault } from '@/components/react/MempoolFeeMarket';
export type { MempoolFeeMarketProps } from '@/components/react/MempoolFeeMarket';

export { UtxoVsAccount, default as UtxoVsAccountDefault } from '@/components/react/UtxoVsAccount';
export type { UtxoVsAccountProps } from '@/components/react/UtxoVsAccount';

export { FrequencyLadder, default as FrequencyLadderDefault } from '@/components/react/FrequencyLadder';
export type { FrequencyLadderProps } from '@/components/react/FrequencyLadder';

export { AprApyDial, default as AprApyDialDefault } from '@/components/react/AprApyDial';
export type { AprApyDialProps } from '@/components/react/AprApyDial';

export { RealRateBars, default as RealRateBarsDefault } from '@/components/react/RealRateBars';
export type { RealRateBarsProps } from '@/components/react/RealRateBars';

export { BarterMatch, default as BarterMatchDefault } from '@/components/react/BarterMatch';
export type { BarterMatchProps } from '@/components/react/BarterMatch';

export { MoneyFunctions, default as MoneyFunctionsDefault } from '@/components/react/MoneyFunctions';
export type { MoneyFunctionsProps } from '@/components/react/MoneyFunctions';

export { PaymentFlow, default as PaymentFlowDefault } from '@/components/react/PaymentFlow';
export type { PaymentFlowProps } from '@/components/react/PaymentFlow';

export { CashFlowLoop, default as CashFlowLoopDefault } from '@/components/react/CashFlowLoop';
export type { CashFlowLoopProps } from '@/components/react/CashFlowLoop';

export { DoubleEntryLedger, default as DoubleEntryLedgerDefault } from '@/components/react/DoubleEntryLedger';
export type { DoubleEntryLedgerProps } from '@/components/react/DoubleEntryLedger';

export { RiskLadder, default as RiskLadderDefault } from '@/components/react/RiskLadder';
export type { RiskLadderProps, RiskLadderRung } from '@/components/react/RiskLadder';

export { TotalReturnStack, default as TotalReturnStackDefault } from '@/components/react/TotalReturnStack';
export type { TotalReturnStackProps } from '@/components/react/TotalReturnStack';

export { DiversifyBasket, default as DiversifyBasketDefault } from '@/components/react/DiversifyBasket';
export type { DiversifyBasketProps } from '@/components/react/DiversifyBasket';

export { BondCashflows, default as BondCashflowsDefault } from '@/components/react/BondCashflows';
export type { BondCashflowsProps } from '@/components/react/BondCashflows';

export { PriceYieldSeesaw, default as PriceYieldSeesawDefault } from '@/components/react/PriceYieldSeesaw';
export type { PriceYieldSeesawProps } from '@/components/react/PriceYieldSeesaw';

export { YieldCurveShapes, default as YieldCurveShapesDefault } from '@/components/react/YieldCurveShapes';
export type { YieldCurveShapesProps } from '@/components/react/YieldCurveShapes';

export { DurationBalance, default as DurationBalanceDefault } from '@/components/react/DurationBalance';
export type { DurationBalanceProps } from '@/components/react/DurationBalance';

export { ConvexityCurve, default as ConvexityCurveDefault } from '@/components/react/ConvexityCurve';
export type { ConvexityCurveProps } from '@/components/react/ConvexityCurve';

export { ProofOfWork, default as ProofOfWorkDefault } from '@/components/react/ProofOfWork';
export type { ProofOfWorkProps } from '@/components/react/ProofOfWork';

export { HalvingSupply, default as HalvingSupplyDefault } from '@/components/react/HalvingSupply';
export type { HalvingSupplyProps } from '@/components/react/HalvingSupply';

export { LightningChannel, default as LightningChannelDefault } from '@/components/react/LightningChannel';
export type { LightningChannelProps } from '@/components/react/LightningChannel';
