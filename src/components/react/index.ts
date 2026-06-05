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

export { EvmStateMachine, default as EvmStateMachineDefault } from '@/components/react/EvmStateMachine';
export type { EvmStateMachineProps } from '@/components/react/EvmStateMachine';

export { GasFeeBreakdown, default as GasFeeBreakdownDefault } from '@/components/react/GasFeeBreakdown';
export type { GasFeeBreakdownProps } from '@/components/react/GasFeeBreakdown';

export { TokenLedger, default as TokenLedgerDefault } from '@/components/react/TokenLedger';
export type { TokenLedgerProps } from '@/components/react/TokenLedger';

export { StakeWheel, default as StakeWheelDefault } from '@/components/react/StakeWheel';
export type { StakeWheelProps } from '@/components/react/StakeWheel';

export { RollupBatch, default as RollupBatchDefault } from '@/components/react/RollupBatch';
export type { RollupBatchProps } from '@/components/react/RollupBatch';

export { LendingPoolFlow, default as LendingPoolFlowDefault } from '@/components/react/LendingPoolFlow';
export type { LendingPoolFlowProps } from '@/components/react/LendingPoolFlow';

export { BorrowPowerBar, default as BorrowPowerBarDefault } from '@/components/react/BorrowPowerBar';
export type { BorrowPowerBarProps } from '@/components/react/BorrowPowerBar';

export { UtilizationRateCurve, default as UtilizationRateCurveDefault } from '@/components/react/UtilizationRateCurve';
export type { UtilizationRateCurveProps } from '@/components/react/UtilizationRateCurve';

export { HealthFactorMeter, default as HealthFactorMeterDefault } from '@/components/react/HealthFactorMeter';
export type { HealthFactorMeterProps } from '@/components/react/HealthFactorMeter';

export { FlashLoanLoop, default as FlashLoanLoopDefault } from '@/components/react/FlashLoanLoop';
export type { FlashLoanLoopProps } from '@/components/react/FlashLoanLoop';

export { MoneyTimeline, default as MoneyTimelineDefault } from '@/components/react/MoneyTimeline';
export type { MoneyTimelineProps, MoneyTimelineEvent } from '@/components/react/MoneyTimeline';

export { PurchasingPowerDecay, default as PurchasingPowerDecayDefault } from '@/components/react/PurchasingPowerDecay';
export type { PurchasingPowerDecayProps } from '@/components/react/PurchasingPowerDecay';

export { GoldPegDiagram, default as GoldPegDiagramDefault } from '@/components/react/GoldPegDiagram';
export type { GoldPegDiagramProps } from '@/components/react/GoldPegDiagram';

export { AmortizationSplit, default as AmortizationSplitDefault } from '@/components/react/AmortizationSplit';
export type { AmortizationSplitProps } from '@/components/react/AmortizationSplit';

export { TermTradeoff, default as TermTradeoffDefault } from '@/components/react/TermTradeoff';
export type { TermTradeoffProps } from '@/components/react/TermTradeoff';

export { LtvMeter, default as LtvMeterDefault } from '@/components/react/LtvMeter';
export type { LtvMeterProps } from '@/components/react/LtvMeter';

export { RatePathChart, default as RatePathChartDefault } from '@/components/react/RatePathChart';
export type { RatePathChartProps } from '@/components/react/RatePathChart';

export { PegArbitrage, default as PegArbitrageDefault } from '@/components/react/PegArbitrage';
export type { PegArbitrageProps } from '@/components/react/PegArbitrage';

export { ReserveComposition, default as ReserveCompositionDefault } from '@/components/react/ReserveComposition';
export type { ReserveCompositionProps, ReserveProfile, ReserveSlice } from '@/components/react/ReserveComposition';

export { DeathSpiral, default as DeathSpiralDefault } from '@/components/react/DeathSpiral';
export type { DeathSpiralProps } from '@/components/react/DeathSpiral';

export { DepegTimeline, default as DepegTimelineDefault } from '@/components/react/DepegTimeline';
export type { DepegTimelineProps, DepegPoint, DepegEvent } from '@/components/react/DepegTimeline';

export { ConstantProductCurve, default as ConstantProductCurveDefault } from '@/components/react/ConstantProductCurve';
export type { ConstantProductCurveProps } from '@/components/react/ConstantProductCurve';

export { OrderbookVsAmm, default as OrderbookVsAmmDefault } from '@/components/react/OrderbookVsAmm';
export type { OrderbookVsAmmProps, OrderbookVsAmmRow, OrderbookLevel } from '@/components/react/OrderbookVsAmm';

export { LiquidityPoolShare, default as LiquidityPoolShareDefault } from '@/components/react/LiquidityPoolShare';
export type { LiquidityPoolShareProps } from '@/components/react/LiquidityPoolShare';

export { SlippageCurve, default as SlippageCurveDefault } from '@/components/react/SlippageCurve';
export type { SlippageCurveProps } from '@/components/react/SlippageCurve';

export { ImpermanentLossCurve, default as ImpermanentLossCurveDefault } from '@/components/react/ImpermanentLossCurve';
export type { ImpermanentLossCurveProps } from '@/components/react/ImpermanentLossCurve';

export { DiversificationDecay, default as DiversificationDecayDefault } from '@/components/react/DiversificationDecay';
export type { DiversificationDecayProps } from '@/components/react/DiversificationDecay';

export { CorrelationBlender, default as CorrelationBlenderDefault } from '@/components/react/CorrelationBlender';
export type { CorrelationBlenderProps } from '@/components/react/CorrelationBlender';

export { TwoAssetFrontier, default as TwoAssetFrontierDefault } from '@/components/react/TwoAssetFrontier';
export type { TwoAssetFrontierProps } from '@/components/react/TwoAssetFrontier';

export { EfficientFrontier, default as EfficientFrontierDefault } from '@/components/react/EfficientFrontier';
export type { EfficientFrontierProps } from '@/components/react/EfficientFrontier';

export { CapitalMarketLine, default as CapitalMarketLineDefault } from '@/components/react/CapitalMarketLine';
export type { CapitalMarketLineProps } from '@/components/react/CapitalMarketLine';

export { SecurityMarketLine, default as SecurityMarketLineDefault } from '@/components/react/SecurityMarketLine';
export type { SecurityMarketLineProps } from '@/components/react/SecurityMarketLine';

export { OptionPayoff, default as OptionPayoffDefault } from '@/components/react/OptionPayoff';
export type { OptionPayoffProps, PayoffLeg } from '@/components/react/OptionPayoff';

export { PremiumDecomposition, default as PremiumDecompositionDefault } from '@/components/react/PremiumDecomposition';
export type { PremiumDecompositionProps } from '@/components/react/PremiumDecomposition';

export { TimeDecayCurve, default as TimeDecayCurveDefault } from '@/components/react/TimeDecayCurve';
export type { TimeDecayCurveProps } from '@/components/react/TimeDecayCurve';

export { OptionDriversBars, default as OptionDriversBarsDefault } from '@/components/react/OptionDriversBars';
export type { OptionDriversBarsProps, OptionDriver, DriverEffect } from '@/components/react/OptionDriversBars';

export { BinomialTree, default as BinomialTreeDefault } from '@/components/react/BinomialTree';
export type { BinomialTreeProps } from '@/components/react/BinomialTree';

export { LognormalPrice, default as LognormalPriceDefault } from '@/components/react/LognormalPrice';
export type { LognormalPriceProps } from '@/components/react/LognormalPrice';

export { GreeksCurve, default as GreeksCurveDefault } from '@/components/react/GreeksCurve';
export type { GreeksCurveProps } from '@/components/react/GreeksCurve';

export { VolSmile, default as VolSmileDefault } from '@/components/react/VolSmile';
export type { VolSmileProps } from '@/components/react/VolSmile';

export { VarDistributionChart, default as VarDistributionChartDefault } from '@/components/react/VarDistributionChart';
export type { VarDistributionChartProps } from '@/components/react/VarDistributionChart';

export { HistoricalVarLadder, default as HistoricalVarLadderDefault } from '@/components/react/HistoricalVarLadder';
export type { HistoricalVarLadderProps } from '@/components/react/HistoricalVarLadder';

export { VarHorizonScaling, default as VarHorizonScalingDefault } from '@/components/react/VarHorizonScaling';
export type { VarHorizonScalingProps } from '@/components/react/VarHorizonScaling';

export { VarBacktestTimeline, default as VarBacktestTimelineDefault } from '@/components/react/VarBacktestTimeline';
export type { VarBacktestTimelineProps } from '@/components/react/VarBacktestTimeline';

export { MevOrderingAuction, default as MevOrderingAuctionDefault } from '@/components/react/MevOrderingAuction';
export type { MevOrderingAuctionProps, MevTransaction } from '@/components/react/MevOrderingAuction';

export { SandwichAttack, default as SandwichAttackDefault } from '@/components/react/SandwichAttack';
export type { SandwichAttackProps } from '@/components/react/SandwichAttack';

export { BlockOrderTimeline, default as BlockOrderTimelineDefault } from '@/components/react/BlockOrderTimeline';
export type { BlockOrderTimelineProps } from '@/components/react/BlockOrderTimeline';

export { MevSupplyChain, default as MevSupplyChainDefault } from '@/components/react/MevSupplyChain';
export type { MevSupplyChainProps, MevStage } from '@/components/react/MevSupplyChain';

export { MonteCarloConverge, default as MonteCarloConvergeDefault } from '@/components/react/MonteCarloConverge';
export type { MonteCarloConvergeProps } from '@/components/react/MonteCarloConverge';

export { SamplingHistogram, default as SamplingHistogramDefault } from '@/components/react/SamplingHistogram';
export type { SamplingHistogramProps } from '@/components/react/SamplingHistogram';

export { GbmPaths, default as GbmPathsDefault } from '@/components/react/GbmPaths';
export type { GbmPathsProps } from '@/components/react/GbmPaths';

export { OutcomeFan, default as OutcomeFanDefault } from '@/components/react/OutcomeFan';
export type { OutcomeFanProps } from '@/components/react/OutcomeFan';

export { VarianceReductionChart, default as VarianceReductionChartDefault } from '@/components/react/VarianceReductionChart';
export type { VarianceReductionChartProps } from '@/components/react/VarianceReductionChart';

export { GeometricMeanGap, default as GeometricMeanGapDefault } from '@/components/react/GeometricMeanGap';
export type { GeometricMeanGapProps } from '@/components/react/GeometricMeanGap';

export { VolatilityDragCurve, default as VolatilityDragCurveDefault } from '@/components/react/VolatilityDragCurve';
export type { VolatilityDragCurveProps } from '@/components/react/VolatilityDragCurve';

export { KellyGrowthCurve, default as KellyGrowthCurveDefault } from '@/components/react/KellyGrowthCurve';
export type { KellyGrowthCurveProps } from '@/components/react/KellyGrowthCurve';

export { FractionalKellyBars, default as FractionalKellyBarsDefault } from '@/components/react/FractionalKellyBars';
export type { FractionalKellyBarsProps } from '@/components/react/FractionalKellyBars';

export { BetSizingPaths, default as BetSizingPathsDefault } from '@/components/react/BetSizingPaths';
export type { BetSizingPathsProps } from '@/components/react/BetSizingPaths';
