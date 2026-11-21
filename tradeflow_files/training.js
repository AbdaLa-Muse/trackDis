const topics=[
{name:"Risk Management",desc:"1% base risk, 1% daily loss limit, -5% weekly maximum drawdown, 2% special-risk day, and weekly protection."},
{name:"Before Trade",desc:"Confirm the setup, entry, stop loss, take profit, and risk before entering."},
{name:"During Trade",desc:"Follow the original plan. Do not change SL or TP because of emotion, and do not rush to break-even."},
{name:"After Loss",desc:"Accept valid losses, avoid revenge trading, and judge the quality of execution."},
{name:"After Win",desc:"A win does not change your risk, rules, or discipline. Avoid overtrading."},
{name:"Bad Performance State",desc:"A losing streak or drawdown does not change the strategy or risk rules."},
{name:"Good Performance State",desc:"A winning streak or strong profit does not justify more risk or weaker rules."},
{name:"Neutrality Between Trades",desc:"Judge each trade independently. The previous result must not control the next decision."},
{name:"Process Over Outcome",desc:"Correct execution matters more than the result of one trade."}
];

const practiceSections=[
{name:"Before Trade",desc:"Validate the setup, entry, SL, TP, timing, and risk before committing capital."},
{name:"During Trade",desc:"Manage an open trade without fear, greed, impatience, or unnecessary interference."},
{name:"After Trade",desc:"Respond correctly after wins and losses, and review execution instead of reacting emotionally."},
{name:"Good Performance State",desc:"Stay disciplined during winning streaks and strong performance without increasing risk or lowering standards."},
{name:"All Setups Quiz",desc:"Master all four trading setups: Break + Gap / Breaker Block, Inducement + Liquidity Sweep, Consolidation Sweep + Structure Break, and Multi-Timeframe Alignment + Gap."}
];

const bank=[
// 1. RISK MANAGEMENT — 10
{topic:"Risk Management",q:"What is the standard base risk for one trade idea?",a:["0.5%","1%","1.5%","2%"],correct:1,why:"The base risk is fixed at 1% per trade idea."},
{topic:"Risk Management",q:"You have lost 1% today. A very strong setup appears later. What should you do?",a:["Take it at 0.5% risk","Take it only if it is an A+ setup","Stop trading for the day","Wait one hour and then trade"],correct:2,why:"Once the daily loss reaches 1%, trading stops for the day."},
{topic:"Risk Management",q:"What is the maximum weekly drawdown allowed by the system?",a:["-3%","-4%","-5%","-6%"],correct:2,why:"The weekly maximum drawdown is -5%."},
{topic:"Risk Management",q:"You are up 4% for the week. Can you increase normal trade risk to 1.5%?",a:["Yes, because you have a profit cushion","Yes, only for A+ setups","No, the fixed-risk model does not allow it","Yes, but only on Friday"],correct:2,why:"Risk is not increased or reduced because of weekly performance."},
{topic:"Risk Management",q:"On the special-risk day, what is the maximum total risk allowed?",a:["1%","1.5%","2%","3%"],correct:2,why:"One day per week may carry up to 2% total risk."},
{topic:"Risk Management",q:"On the special-risk day, you open two positions at the same time: one risks 1.2% and the other 0.8%. Is this allowed?",a:["Yes, the combined risk is 2%","No, each trade must risk exactly 1%","No, two positions are never allowed","Yes, but only if both are on the same pair"],correct:0,why:"The 2% exposure can be one trade or multiple simultaneous positions, as long as combined risk does not exceed 2%."},
{topic:"Risk Management",q:"How is the special-risk day selected?",a:["It is fixed by the broker","It must always be Monday","You choose it based on market conditions","It must follow a winning day"],correct:2,why:"The special-risk day is selected at your discretion based on market conditions."},
{topic:"Risk Management",q:"You lost 1% on Monday and want to use the 2% allocation on Tuesday to recover it quickly. What is the correct response?",a:["Use 2% if the setup looks strong","Use 2% if there is only one trade","Do not use the 2% allocation for recovery trading","Use 2% only if the target is above 2R"],correct:2,why:"The 2% allocation must never be used emotionally to recover previous losses."},
{topic:"Risk Management",q:"You are down 4.4% for the week. A new trade would risk 1%. What should you do?",a:["Take it because the weekly limit has not been reached yet","Take it if the setup is A+","Do not take it because full risk could push the week beyond -5%","Take it with a tighter stop"],correct:2,why:"No trade may be taken if its full risk could push weekly drawdown beyond -5%."},
{topic:"Risk Management",q:"You are down 4.2% for the week. A trade risks 0.8%. What does the weekly-protection rule say?",a:["It may be taken because a full loss would bring the week to exactly -5.0%","It is never allowed below -4%","Risk must be increased to 1%","It automatically becomes the special-risk day"],correct:0,why:"The rule prevents trades that could push drawdown beyond -5%. A full 0.8% loss from -4.2% reaches -5.0%, not beyond it."},

// 2. BEFORE TRADE — 10
{topic:"Before Trade",q:"What must be confirmed first before taking a trade?",a:["That the market is moving fast","That the trade fully matches the strategy and system","That you are already profitable today","That there is economic news"],correct:1,why:"A trade must fully match the strategy and system before it is considered."},
{topic:"Before Trade",q:"The setup is visible, but the entry point is not clear. What should you do?",a:["Enter early","Enter with half risk","Wait for a clear entry or skip the trade","Drop to a lower timeframe until you find any entry"],correct:2,why:"If the setup or entry is not clear, no trade should be taken."},
{topic:"Before Trade",q:"When should stop loss and take profit be planned?",a:["After entry","Once the trade moves into profit","Before the trade is opened","Only if the market moves against you"],correct:2,why:"SL and TP must be planned before entry."},
{topic:"Before Trade",q:"Price is close to your setup, but the planned entry confirmation has not appeared yet. What should you do?",a:["Enter now to avoid missing the move","Wait for the clear entry","Enter at 0.5% risk","Enter without a take-profit target"],correct:1,why:"The entry should be clear and should not be taken too early."},
{topic:"Before Trade",q:"Price has already moved far beyond your planned entry. What is the key question now?",a:["Is this entry now too late?","Can I double the risk?","Can I trade without a stop loss?","Do I have to chase the move?"],correct:0,why:"The entry must be evaluated carefully so it is not too early or too late."},
{topic:"Before Trade",q:"The setup is valid, but the risk you want to use breaks your risk-management rules. What should you do?",a:["Take the trade because the setup is valid","Take it if the reward is large","Do not take it until the risk fits the system","Enter and manage the risk later"],correct:2,why:"Every trade must comply with the Risk Management System."},
{topic:"Before Trade",q:"You have a clear setup and entry, but you do not know where the stop loss should be. What should you do?",a:["Enter first and decide later","Do not trade until the stop loss is clear","Use more risk to create space","Enter without a stop"],correct:1,why:"The stop loss is part of the pre-trade plan and must be clear before entry."},
{topic:"Before Trade",q:"The market is moving quickly and you feel afraid of missing out. What should control your decision?",a:["The speed of the move","Your entry criteria and system","The size of the candle","Your fear of missing the trade"],correct:1,why:"A trade is taken because the system and entry criteria are satisfied, not because of FOMO."},
{topic:"Before Trade",q:"Which checklist best matches the system before entry?",a:["Setup, entry, SL, TP, risk","Daily profit target, confidence, news","Win rate, mood, chart colour","Spread, boredom, previous result"],correct:0,why:"Before entry, the setup, entry, SL, TP, and risk should all be clear."},
{topic:"Before Trade",q:"If one important part of the trade plan is unclear, what is the default action?",a:["Trade with smaller size","Do not take the trade","Enter first and plan later","Convert it into a scalp"],correct:1,why:"A trade should not be taken when the setup or entry plan is unclear."},

// 3. DURING TRADE — 10
{topic:"During Trade",q:"Your trade is open and price is approaching the stop loss. There is no new valid reason to change the plan. Can you widen the stop?",a:["Yes, to give the trade more room","No, the planned stop should remain unchanged","Yes, if you dislike taking the loss","Yes, if you also move the target"],correct:1,why:"The stop loss was planned in advance and should not be changed because of emotion."},
{topic:"During Trade",q:"Your trade is only 8 pips in profit and you want to move to break-even to avoid any loss. What should you do?",a:["Move to break-even immediately","Wait until at least 20 pips or until there is a clear logical reason","Close the trade","Reduce the take-profit target"],correct:1,why:"Break-even should not be moved too early. Normally wait for at least 20 pips or a clear rational reason."},
{topic:"During Trade",q:"Your trade is 22 pips in profit and there is a clear logical reason to move to break-even. Is that allowed?",a:["No, break-even is never allowed","Yes, because the move is supported by the rule and a clear reason","Only if the trade was previously in loss","Only if your daily target is reached"],correct:1,why:"Break-even is allowed when there is enough progress and a clear rational reason."},
{topic:"During Trade",q:"Price pulls back slightly from profit and you feel nervous. What should you do?",a:["Close manually to protect a small profit","Follow the original plan and do not close from fear","Move the stop close to price","Add another position"],correct:1,why:"A trade should not be manually closed because of fear or impatience."},
{topic:"During Trade",q:"You feel greedy and want to push the take-profit target further away after entry. What should you do?",a:["Extend the target","Keep the original target unless there is a valid system-based reason","Remove the stop loss","Double the position"],correct:1,why:"SL and TP should not be changed because of emotion."},
{topic:"During Trade",q:"Which principle is most important while the trade is open?",a:["React to every candle","Follow the original plan","Protect every small profit","Change the plan whenever confidence changes"],correct:1,why:"Once in the trade, execution should follow the plan made before entry."},
{topic:"During Trade",q:"The trade moves against you and you start hoping it will come back. What should you do?",a:["Remove the stop loss","Keep the planned stop loss","Add more size","Move the stop further away"],correct:1,why:"Hope is not a valid reason to change risk after entry."},
{topic:"During Trade",q:"Price is 15 pips in profit and nothing important has changed. What is the best response?",a:["Move to break-even immediately","Continue following the original plan","Close half because 15 pips is enough","Move the target closer out of fear"],correct:1,why:"The system discourages early break-even moves and emotional trade management."},
{topic:"During Trade",q:"Which action clearly breaks the system during a trade?",a:["Keeping the planned stop","Following the planned target","Moving the stop because you are afraid of losing","Waiting for the planned outcome"],correct:2,why:"Emotional changes to SL or TP are not allowed."},
{topic:"During Trade",q:"What should determine any valid management decision after entry?",a:["Fear, greed, or urgency","A clear reason consistent with the system","The previous trade result","How much profit you want today"],correct:1,why:"Trade management must remain logical and system-based rather than emotional."},

// 4. AFTER LOSS — 10
{topic:"After Loss",q:"A trade followed the system correctly but ended in a loss. What should you do?",a:["Assume the strategy failed","Accept the loss as part of correct execution","Increase risk on the next trade","Change the entry rules immediately"],correct:1,why:"A valid loss is accepted when the trade followed the system correctly."},
{topic:"After Loss",q:"What is revenge trading?",a:["Taking a valid setup after a loss","Trading emotionally to recover a previous loss","Reviewing a losing trade","Reducing screen time after a loss"],correct:1,why:"Revenge trading is an emotional attempt to recover losses quickly."},
{topic:"After Loss",q:"After a loss, should you increase risk on the next trade to recover faster?",a:["Yes, if confidence is high","Yes, only once","No","Only on a strong trend"],correct:2,why:"Risk is not changed because of a loss."},
{topic:"After Loss",q:"You have reached the 1% daily loss limit. What happens next?",a:["You may take one more trade","You may trade at half risk","Trading stops for the day","You may continue only on the special-risk day"],correct:2,why:"The daily loss limit ends trading for that day."},
{topic:"After Loss",q:"How should a losing trade be reviewed?",a:["Only by looking at the money lost","By judging whether the system was executed correctly","By deciding whether you felt confident","By comparing it with social-media trades"],correct:1,why:"The trade should be judged on execution, not outcome alone."},
{topic:"After Loss",q:"A losing trade was entered too early and did not follow your rules. What is the main lesson?",a:["Losses are always random","The execution error must be identified","Increase risk next time","The stop loss should be removed"],correct:1,why:"The review should identify whether the loss came with correct or incorrect execution."},
{topic:"After Loss",q:"You feel frustrated after two losses. What is the correct response?",a:["Force another trade to recover","Keep the same system and risk rules","Change strategy immediately","Trade only larger positions"],correct:1,why:"Frustration should not change the strategy or risk rules."},
{topic:"After Loss",q:"Which thought is most consistent with the system after a valid loss?",a:["I must win it back now","The loss is acceptable if I followed my process","I need a new strategy immediately","My next trade must be bigger"],correct:1,why:"The system values correct execution even when the result is a loss."},
{topic:"After Loss",q:"Should one losing trade cause you to redesign the strategy?",a:["Yes, immediately","No, not unless there is a genuine system-based reason supported by evidence","Yes, if the loss was full risk","Yes, if the next setup looks different"],correct:1,why:"A single loss is not a valid reason to change a tested process."},
{topic:"After Loss",q:"What should you avoid most after a loss?",a:["Reviewing the trade","Accepting the result","Emotional recovery trading","Checking whether rules were followed"],correct:2,why:"The main danger after a loss is allowing emotion to drive the next decision."},

// 5. AFTER WIN — 10
{topic:"After Win",q:"You have just had a strong winning trade. What should happen to your normal risk?",a:["Increase it","Keep it unchanged","Double it for one trade","Reduce it because you already made profit"],correct:1,why:"A win does not change the fixed-risk model."},
{topic:"After Win",q:"What is overtrading after a win?",a:["Taking the next valid setup","Taking extra trades because confidence is high","Reviewing your winning trade","Stopping after the planned session"],correct:1,why:"A win should not create unnecessary extra trading."},
{topic:"After Win",q:"Can a winning streak justify weaker entry criteria?",a:["Yes, because momentum is on your side","No","Only for one trade","Only if the previous trade was above 2R"],correct:1,why:"Winning does not relax strategy rules."},
{topic:"After Win",q:"You feel extremely confident after three wins. What should guide the next trade?",a:["Confidence","The normal strategy and risk rules","The desire to maximise the streak","A larger lot size"],correct:1,why:"Each new trade is still judged by the same system."},
{topic:"After Win",q:"What should a win change about your discipline?",a:["Nothing","It should make you more aggressive","It should allow faster entries","It should allow more trades"],correct:0,why:"A win must not change discipline or system execution."},
{topic:"After Win",q:"After a profitable trade, the next setup is unclear. What should you do?",a:["Take it because you are trading well","Skip it until the setup is clear","Use smaller risk and enter","Enter because you can afford a loss"],correct:1,why:"Previous profit does not make an unclear setup acceptable."},
{topic:"After Win",q:"Why is increasing risk after a win a problem?",a:["It changes the fixed-risk process because of emotion or confidence","It always lowers reward","It makes the platform slower","It changes market direction"],correct:0,why:"Risk should remain fixed rather than responding to confidence."},
{topic:"After Win",q:"You hit your take profit and immediately want another trade even though no valid setup exists. What should you do?",a:["Search for any trade","Wait for a valid setup","Increase risk to use the momentum","Trade a different market without a plan"],correct:1,why:"A win is not a reason to force another trade."},
{topic:"After Win",q:"How should the next trade be evaluated after a win?",a:["As part of the winning streak","Independently, using the same system","With higher risk","With looser rules"],correct:1,why:"Every trade must be evaluated independently."},
{topic:"After Win",q:"Which statement best matches the system?",a:["Winning earns permission to break rules","Winning confirms you should trade more","Winning does not change the process","Winning means the next setup is more likely to work"],correct:2,why:"The process remains the same after both wins and losses."},

// 6. BAD PERFORMANCE STATE — 10
{topic:"Bad Performance State",q:"You are in a losing streak. Should you change the strategy because of frustration?",a:["Yes","No, not unless the system gives a genuine reason for review","Yes, after two losses","Only if the last loss was large"],correct:1,why:"A bad performance state must not create emotional strategy changes."},
{topic:"Bad Performance State",q:"You are in drawdown and start doubting every valid setup. What should you rely on?",a:["Your current fear","The same objective system criteria","The previous losing streak","A random lower-risk entry"],correct:1,why:"Doubt should not replace the system's decision process."},
{topic:"Bad Performance State",q:"What should happen to your risk rules during a loss streak?",a:["They should become more aggressive","They should remain unchanged","They should be removed temporarily","They should depend on mood"],correct:1,why:"A loss streak does not change the fixed risk rules."},
{topic:"Bad Performance State",q:"You strongly want to recover recent losses today. What should control your actions?",a:["The urge to recover","The original system and limits","A larger special-risk allocation","The size of the drawdown"],correct:1,why:"Recovery pressure must not control trading decisions."},
{topic:"Bad Performance State",q:"What is the correct response to frustration during drawdown?",a:["Take more trades","Keep the same process and follow the limits","Move stops wider","Change the strategy mid-session"],correct:1,why:"Frustration is a state to manage, not a reason to alter the system."},
{topic:"Bad Performance State",q:"When is it reasonable to review the system itself?",a:["Whenever you feel uncomfortable","When there is a genuine evidence-based reason, not just emotion","After every loss","Only after a winning week"],correct:1,why:"System review should be based on real evidence, not temporary frustration or doubt."},
{topic:"Bad Performance State",q:"Which behaviour shows poor performance-state discipline?",a:["Following the same rules in drawdown","Changing risk because you want to recover losses","Stopping at the daily loss limit","Reviewing execution objectively"],correct:1,why:"Changing risk for recovery is emotional and breaks the process."},
{topic:"Bad Performance State",q:"You are down for the week but a valid setup appears within all risk limits. How should it be judged?",a:["By the current setup and system","By your fear of another loss","By the desire to recover","By whether the last trade won"],correct:0,why:"The setup should be judged objectively, even during a difficult week."},
{topic:"Bad Performance State",q:"What is the purpose of staying consistent in a bad performance state?",a:["To force a quick recovery","To stop emotion from changing decisions","To guarantee the next trade wins","To avoid using stop losses"],correct:1,why:"Consistency protects the system from emotional decision-making."},
{topic:"Bad Performance State",q:"Which statement is correct during drawdown?",a:["The rules matter less because performance is poor","The same rules still apply","Risk should increase to recover faster","Every setup should be skipped"],correct:1,why:"Drawdown does not suspend or weaken the system."},

// 7. GOOD PERFORMANCE STATE — 10
{topic:"Good Performance State",q:"You are on a winning streak. Should you increase normal risk because you feel confident?",a:["Yes","No","Only for one trade","Only after three wins"],correct:1,why:"A winning streak does not justify higher risk."},
{topic:"Good Performance State",q:"Strong profit this week makes you want to relax your entry rules. What should you do?",a:["Relax them slightly","Keep the same strategy rules","Trade more often","Remove the stop loss on A+ setups"],correct:1,why:"Profit does not give permission to weaken the rules."},
{topic:"Good Performance State",q:"What is the main psychological danger of a good performance state?",a:["Overconfidence","Too little screen time","Using a stop loss","Taking fewer trades"],correct:0,why:"Strong performance can create overconfidence and rule-breaking."},
{topic:"Good Performance State",q:"You are well above your weekly target. Does that allow extra trades outside your plan?",a:["Yes, because the week is already profitable","No","Only at half risk","Only if the market is active"],correct:1,why:"Profit should not cause overtrading or rule-breaking."},
{topic:"Good Performance State",q:"After several wins, what should happen to your strategy criteria?",a:["They should remain the same","They should become easier","They should depend on profit","They should allow earlier entries"],correct:0,why:"The strategy rules remain unchanged during good performance."},
{topic:"Good Performance State",q:"Which response best protects you from overconfidence?",a:["Increase risk slowly","Treat the next trade like any other trade","Trade more because confidence is useful","Skip stop-loss planning"],correct:1,why:"Neutral, repeatable execution prevents confidence from changing behaviour."},
{topic:"Good Performance State",q:"You made a large profit today and feel almost certain the next setup will win. What should you remember?",a:["Confidence makes the setup stronger","The next trade still has to meet the same rules","You should use the 2% day immediately","The next trade does not need a full plan"],correct:1,why:"Previous profit does not improve the quality of the next setup."},
{topic:"Good Performance State",q:"Can a winning streak be used as a reason to choose the special-risk day?",a:["Yes, automatically","No, the day should be chosen based on market conditions, not emotion","Yes, after two wins","Yes, if you want to maximise profit"],correct:1,why:"The special-risk day is based on market conditions, not excitement from recent wins."},
{topic:"Good Performance State",q:"Which behaviour breaks the system after strong performance?",a:["Keeping 1% base risk","Following the same entry rules","Taking low-quality setups because you feel confident","Stopping when rules say to stop"],correct:2,why:"Overconfidence must not weaken setup quality or discipline."},
{topic:"Good Performance State",q:"What should strong performance change?",a:["Your process","Your risk model","Nothing about the core rules","Your stop-loss discipline"],correct:2,why:"Strong results do not change the system."},

// 8. NEUTRALITY BETWEEN TRADES — 10
{topic:"Neutrality Between Trades",q:"How much should the previous trade result influence the next valid setup?",a:["A lot","A little","Not at all","Only after a loss"],correct:2,why:"The previous win or loss should not influence the next trade decision."},
{topic:"Neutrality Between Trades",q:"After a loss, a valid setup appears the next day. What should determine whether you enter?",a:["Yesterday's loss","The current system and setup","The need to recover","The day of the week"],correct:1,why:"A new trade is taken based on the current system, not the previous result."},
{topic:"Neutrality Between Trades",q:"What does it mean to judge each trade independently?",a:["Ignore the chart","Do not let previous wins or losses change the current criteria","Do not use a stop loss","Use different risk on every trade"],correct:1,why:"Independence means previous outcomes do not change the current decision criteria."},
{topic:"Neutrality Between Trades",q:"You have lost two trades in a row. A third setup fully meets the system. What is the correct view?",a:["It will probably lose too","Judge it on its own setup and rules","Double the risk to break the streak","Skip it only because of the two losses"],correct:1,why:"Each setup is evaluated independently from the previous results."},
{topic:"Neutrality Between Trades",q:"You have won three trades in a row. The fourth setup is unclear. What should you do?",a:["Take it because the streak is strong","Do not take it because the setup is unclear","Take it at smaller risk","Take it with a closer target"],correct:1,why:"Previous wins do not make an unclear setup valid."},
{topic:"Neutrality Between Trades",q:"What does neutrality protect you from?",a:["Letting the previous outcome emotionally control the next trade","Using a stop loss","Reviewing your strategy","Following a trading plan"],correct:0,why:"Neutrality separates the previous result from the next decision."},
{topic:"Neutrality Between Trades",q:"Which mindset is best before each new trade?",a:["I need to recover what I lost","I need to continue my winning streak","This trade must be judged on its own system-based criteria","The previous result tells me what this trade will do"],correct:2,why:"Every trade should be evaluated on its own setup and rules."},
{topic:"Neutrality Between Trades",q:"After a big win, should you expect the next trade to win because you are trading well?",a:["Yes","No, the next trade is a separate decision","Only if the same market is traded","Only if the setup looks similar"],correct:1,why:"The previous result should not create assumptions about the next trade."},
{topic:"Neutrality Between Trades",q:"After a large loss, you feel afraid to take a valid setup. What should decide the trade?",a:["Fear","The system and risk limits","The size of the previous loss","Your need to feel safe"],correct:1,why:"A valid setup should be judged by the same objective process."},
{topic:"Neutrality Between Trades",q:"Which statement best represents neutrality?",a:["Every trade starts from zero emotionally","Wins allow more confidence in the next trade","Losses require more caution than the system says","The next trade should recover the previous one"],correct:0,why:"Neutrality means beginning each trade without emotional carryover from the previous result."},

// 9. PROCESS OVER OUTCOME — 10
{topic:"Process Over Outcome",q:"A trade was planned correctly, followed every rule, and still lost. How should it be judged?",a:["As a bad trade","As good execution with a losing outcome","As immediate strategy failure","As a discipline failure"],correct:1,why:"Good execution plus a loss is still a good trade from a process perspective."},
{topic:"Process Over Outcome",q:"A trade broke your rules but made a profit. How should it be judged?",a:["As a good trade because it made money","As bad execution despite the profit","As proof the strategy should change","As a successful special-risk trade"],correct:1,why:"Bad execution plus profit is not a good trade."},
{topic:"Process Over Outcome",q:"What should performance be judged on first?",a:["Today's P&L only","How well the system was executed","The number of trades taken","The length of the winning streak"],correct:1,why:"Performance should be judged by the quality of system execution."},
{topic:"Process Over Outcome",q:"What is the main goal of this trading system?",a:["To win every trade","Consistency, discipline, and correct execution","To eliminate all drawdowns","To take more trades"],correct:1,why:"The goal is consistent, disciplined, correct execution."},
{topic:"Process Over Outcome",q:"Why is it wrong to judge a trade only by whether it won or lost?",a:["Because it ignores the quality of the decision and execution","Because it reduces reward-to-risk","Because it removes stop losses","Because it improves strategy too slowly"],correct:0,why:"Outcome alone does not tell you whether the decision process was correct."},
{topic:"Process Over Outcome",q:"You entered without a complete setup and happened to make a profit. What should your review say?",a:["Perfect trade","Rule violation despite the profitable outcome","Strategy confirmation","Risk-management success"],correct:1,why:"Profit does not make poor execution acceptable."},
{topic:"Process Over Outcome",q:"Trade A followed the full system and lost 1R. Trade B broke the system and made 1R. Which trade had better process?",a:["Trade A","Trade B","They are equal","Neither can be evaluated"],correct:0,why:"Trade A had correct execution even though its outcome was negative."},
{topic:"Process Over Outcome",q:"Why is consistency more important than one isolated result?",a:["It allows the system's edge to be executed repeatedly","It makes every trade a winner","It removes drawdowns","It allows unlimited risk"],correct:0,why:"Consistency allows the same valid process to be repeated over time."},
{topic:"Process Over Outcome",q:"You followed the system correctly for five trades, but three were losses. What matters most?",a:["Change the strategy immediately","Keep execution quality high and review the data objectively","Increase risk","Recover the losses today"],correct:1,why:"Short-term outcomes do not replace the need for correct execution and objective review."},
{topic:"Process Over Outcome",q:"How should a disciplined trader define success after one trade?",a:["Profit only","Whether the plan and system were followed correctly","Whether take profit was hit","Whether market direction was predicted"],correct:1,why:"The first measure of success is correct execution, not the outcome alone."}
];


const setupBank=[
// SETUP 1 — 5M BREAK + GAP / BREAKER BLOCK
{topic:"Setup 1",q:"What is the core idea of Setup 1?",a:["5M Break + Gap / Breaker Block","5M Inducement + Liquidity Sweep","Consolidation Sweep only","5M / 15M / 1H Alignment only"],correct:0,why:"Setup 1 is built around a 5M break followed by an entry from a Gap/FVG or a small previous Breaker Block."},
{topic:"Setup 1",q:"What higher-timeframe context can qualify the first stage of Setup 1?",a:["Only a 5M Order Block","A 1H or 4H Order Block / Breaker Block, or a liquidity sweep into a higher-timeframe gap","Only a daily candle close","Any random support or resistance"],correct:1,why:"Setup 1 begins from a valid HTF POI or liquidity sweep, such as a 1H/4H Order Block, Breaker Block, or higher-timeframe gap fill."},
{topic:"Setup 1",q:"Which liquidity-sweep condition is valid in Setup 1?",a:["Only a 1M gap fill","A 1H or 4H gap fill, and sometimes a 15M gap fill","Only a weekly high sweep","A gap fill is never relevant"],correct:1,why:"The playbook allows a 1H or 4H gap fill, and sometimes a 15M gap fill, as the liquidity-sweep context."},
{topic:"Setup 1",q:"After the HTF POI or liquidity sweep, what confirmation do you look for on 5M?",a:["A 5M Structure Break, 5M IFVG, or the defined 3-candle pattern","A 1M moving-average cross","A random wick","A daily engulfing candle only"],correct:0,why:"Setup 1 requires 5M confirmation through a Structure Break, IFVG, or the recognised 3-candle pattern."},
{topic:"Setup 1",q:"Where is the preferred entry area in Setup 1 after confirmation?",a:["Anywhere after the break","A Gap/FVG or a small previous Breaker Block","At the previous day's close only","At market immediately after the sweep"],correct:1,why:"The entry area is the Gap/FVG or a small previous Breaker Block created around the 5M confirmation."},
{topic:"Setup 1",q:"What should price do before entry in the Gap/FVG version of Setup 1?",a:["Never retrace","Retrace back into the entry area and then reject / continue","Create a new 4H high first","Move 100 pips without returning"],correct:1,why:"The setup expects price to return to the Gap/FVG or small Breaker Block before continuing."},
{topic:"Setup 1",q:"Which sequence best matches Setup 1?",a:["HTF POI → 5M confirmation → Gap/FVG or small Breaker Block → Retrace → Entry → Continuation","Alignment → Gap → Entry with no retrace","Consolidation → Entry → Sweep","Inducement → Entry → HTF POI"],correct:0,why:"That is the intended Setup 1 flow from higher-timeframe context to confirmation, retrace, entry, and continuation."},
{topic:"Setup 1",q:"A valid HTF sweep occurs and 5M breaks structure, but there is no clean Gap/FVG or small Breaker Block to retrace into. Is Setup 1 complete?",a:["Yes, enter immediately","No, the planned entry area is missing","Yes, if momentum is strong","Yes, but only with double risk"],correct:1,why:"Setup 1 needs a defined entry area after confirmation; a break alone is not the full setup."},
{topic:"Setup 1",q:"Which feature most clearly separates Setup 1 from Setup 2?",a:["Setup 1 uses a Gap/FVG or small Breaker Block as the entry area","Setup 1 requires three aligned timeframes","Setup 1 requires consolidation","Setup 1 has no 5M confirmation"],correct:0,why:"The main distinction is that Setup 1 focuses on a Gap/FVG or small Breaker Block, while Setup 2 focuses on inducement and its liquidity sweep."},
{topic:"Setup 1",q:"If the 5M confirmation is an IFVG instead of a Structure Break, can Setup 1 still qualify?",a:["No, only Structure Break is valid","Yes, 5M IFVG is one of the valid confirmation options","Only on Fridays","Only if 1H and 15M are aligned"],correct:1,why:"The playbook explicitly allows either a 5M Structure Break, a 5M IFVG, or the defined 3-candle pattern."},
{topic:"Setup 1",q:"What is the final objective after entry in Setup 1?",a:["Immediate reversal","Continuation in the intended direction","A second liquidity sweep before any move","Mandatory consolidation"],correct:1,why:"Once the retrace and entry are complete, the expected outcome is continuation in the intended direction."},

// SETUP 2 — 5M INDUCEMENT + LIQUIDITY SWEEP
{topic:"Setup 2",q:"What is the core idea of Setup 2?",a:["5M Break + Gap only","5M Inducement + Liquidity Sweep","Consolidation without a break","1H alignment only"],correct:1,why:"Setup 2 is defined by a 5M inducement that becomes liquidity and is then swept before continuation."},
{topic:"Setup 2",q:"Which higher-timeframe context can start Setup 2?",a:["An Order Block or a liquidity sweep into a 1H/4H gap, sometimes 15M","Only a 1M imbalance","Only a monthly level","No HTF context is needed"],correct:0,why:"Setup 2 starts from a valid HTF POI or liquidity-sweep context such as an Order Block or higher-timeframe gap fill."},
{topic:"Setup 2",q:"What 5M confirmation is valid before the inducement stage?",a:["5M Structure Break, 5M IFVG, or the defined 3-candle pattern","Only an RSI signal","Only a 15M candle close","No confirmation is required"],correct:0,why:"Setup 2 uses the same 5M confirmation family before the inducement develops."},
{topic:"Setup 2",q:"When should the 5M inducement form in Setup 2?",a:["Before the HTF POI is reached","After the 5M break / confirmation","After the trade is already closed","It is optional and unrelated"],correct:1,why:"After the 5M confirmation, price should create a 5M inducement that later acts as liquidity."},
{topic:"Setup 2",q:"What does the 5M inducement become in this setup?",a:["A fixed take-profit","5M liquidity","A 4H Order Block","A stop-loss level only"],correct:1,why:"The inducement becomes a visible 5M liquidity point that price can return to sweep."},
{topic:"Setup 2",q:"What should price do to the inducement before the intended continuation?",a:["Ignore it completely","Return to it and sweep / take that liquidity","Turn it into a 1H gap","Close the session"],correct:1,why:"The defining behaviour is the return to the inducement, taking the liquidity, and then continuing."},
{topic:"Setup 2",q:"Which sequence best matches Setup 2?",a:["HTF POI / Liquidity Sweep → 5M confirmation → 5M Inducement → Liquidity Sweep → Entry → Continuation","5M alignment → 1H gap → Entry","Consolidation → Gap → Entry","Entry → Inducement → HTF POI"],correct:0,why:"That is the exact logical flow of Setup 2."},
{topic:"Setup 2",q:"A 5M break occurs, but no inducement forms. Which statement is correct?",a:["Setup 2 is incomplete","Setup 2 is complete immediately","You should create an inducement manually","The inducement is not important"],correct:0,why:"The inducement is a defining component of Setup 2. Without it, the setup is not complete."},
{topic:"Setup 2",q:"The inducement forms, but price never returns to sweep it. Has the full Setup 2 entry sequence occurred?",a:["Yes, enter anyway","No, the liquidity-sweep stage is missing","Yes, if the candle is large","Only if Setup 4 also appears"],correct:1,why:"Setup 2 requires price to return and take the inducement liquidity before the planned continuation entry."},
{topic:"Setup 2",q:"Which feature most clearly separates Setup 2 from Setup 1?",a:["The inducement becomes liquidity and is swept before entry","It never uses 5M confirmation","It requires 5M/15M/1H alignment","It always starts with consolidation"],correct:0,why:"Setup 2's signature is the inducement-to-liquidity-sweep sequence."},
{topic:"Setup 2",q:"After the inducement liquidity is swept and entry is taken, what is expected next?",a:["Continuation","Mandatory reversal","A second consolidation first","No directional expectation"],correct:0,why:"The intended final stage is continuation after the liquidity sweep and entry."},

// SETUP 3 — CONSOLIDATION SWEEP + 5M STRUCTURE BREAK
{topic:"Setup 3",q:"What is the core idea of Setup 3?",a:["Consolidation Sweep + 5M Structure Break","5M Inducement only","Multi-timeframe alignment only","Immediate market entry from an Order Block"],correct:0,why:"Setup 3 is built around a 5M consolidation, a sweep of that consolidation, and then a 5M Structure Break."},
{topic:"Setup 3",q:"What higher-timeframe context can begin Setup 3?",a:["Order Block or liquidity sweep into a 1H/4H gap, sometimes 15M","Only a 5M trendline","No context is required","Only a monthly gap"],correct:0,why:"Like the other POI-based setups, Setup 3 begins from a valid HTF POI or liquidity-sweep area."},
{topic:"Setup 3",q:"What must appear on 5M before the consolidation sweep stage?",a:["A clear consolidation","A 1H moving average cross","A daily range expansion","A random spike"],correct:0,why:"Setup 3 specifically requires a 5M consolidation before the sweep."},
{topic:"Setup 3",q:"What happens after the 5M consolidation in Setup 3?",a:["The consolidation is swept","Entry is taken immediately with no sweep","The setup moves to 1H","Risk is doubled"],correct:0,why:"Price should sweep the consolidation before the Structure Break stage."},
{topic:"Setup 3",q:"What should follow the consolidation sweep?",a:["A 5M Structure Break","A 4H gap only","No confirmation","A second consolidation with no break"],correct:0,why:"After the consolidation sweep, the setup requires a 5M Structure Break."},
{topic:"Setup 3",q:"After the Structure Break, which retrace area can be used?",a:["Gap/FVG or an inducement that gets swept","Any candle body","Only the session open","Only a 1H Order Block"],correct:0,why:"The playbook allows a retrace into a Gap/FVG or an inducement that is swept after the break."},
{topic:"Setup 3",q:"Which sequence best matches Setup 3?",a:["HTF POI / Liquidity Sweep → 5M Consolidation → Consolidation Sweep → 5M Structure Break → Gap/FVG or Inducement Sweep → Entry → Continuation","HTF POI → Entry → Consolidation","Alignment → Gap → Entry","Inducement → Gap → Consolidation"],correct:0,why:"That sequence captures the full Setup 3 process."},
{topic:"Setup 3",q:"A consolidation forms and gets swept, but 5M does not break structure. Is Setup 3 ready for entry?",a:["Yes","No, the 5M Structure Break is still required","Yes, if the sweep is large","Yes, if the day is profitable"],correct:1,why:"The Structure Break is a required confirmation after the consolidation sweep."},
{topic:"Setup 3",q:"What is the main feature that separates Setup 3 from Setup 2?",a:["Setup 3 uses a consolidation sweep before the 5M Structure Break","Setup 3 requires all timeframes aligned","Setup 3 has no liquidity concept","Setup 3 never uses a Gap/FVG"],correct:0,why:"Setup 3 is identified by the consolidation → sweep → structure-break sequence, unlike Setup 2's inducement → liquidity sweep."},
{topic:"Setup 3",q:"After the 5M Structure Break, price retraces into a clean FVG and respects it. What stage is this?",a:["The retrace / entry stage","The original HTF POI stage","The consolidation-building stage","The weekly risk stage"],correct:0,why:"The FVG retrace comes after the Structure Break and provides the planned entry area."},
{topic:"Setup 3",q:"What is expected after a valid retrace and entry in Setup 3?",a:["Continuation","Mandatory new consolidation","Immediate opposite Structure Break","No directional bias"],correct:0,why:"The final expected stage is continuation after the retrace and entry."},

// SETUP 4 — 5M / 15M / 1H ALIGNMENT + GAP
{topic:"Setup 4",q:"What is the core idea of Setup 4?",a:["5M / 15M / 1H Alignment + Gap","Consolidation Sweep only","5M Inducement only","Breaker Block only"],correct:0,why:"Setup 4 is based on alignment across 5M, 15M, and 1H, combined with a 5M or 15M gap and retrace."},
{topic:"Setup 4",q:"Which timeframes must be aligned for Setup 4?",a:["1M, 5M, 15M","5M, 15M, and 1H","15M, 1H, and 4H only","1H and Daily only"],correct:1,why:"The playbook requires 5M, 15M, and 1H to point in the same direction."},
{topic:"Setup 4",q:"What does 'alignment' mean in Setup 4?",a:["All three required timeframes are moving / structured in the same direction","All three timeframes have identical candle sizes","All gaps are the same size","The market is flat on every timeframe"],correct:0,why:"Alignment means the 5M, 15M, and 1H directional structure agrees."},
{topic:"Setup 4",q:"Which gap can be used in Setup 4?",a:["A 5M gap or 15M gap","Only a 4H gap","Only a weekly gap","No gap is used"],correct:0,why:"Setup 4 specifically uses a 5M or 15M gap."},
{topic:"Setup 4",q:"What should price do after the aligned gap is identified?",a:["Retrace back to the gap","Run away without any retrace","Create an inducement first in every case","Wait for a daily close"],correct:0,why:"The setup expects price to retrace back into the 5M or 15M gap."},
{topic:"Setup 4",q:"What happens to the gap during the retrace stage?",a:["It is filled / closed before continuation","It must remain completely untouched","It becomes a 4H Order Block","It is ignored"],correct:0,why:"The retrace fills or closes the gap, creating the entry stage before continuation."},
{topic:"Setup 4",q:"Which sequence best matches Setup 4?",a:["5M + 15M + 1H Alignment → 5M/15M Gap → Retrace / Gap Fill → Entry → Continuation","HTF POI → Inducement → Sweep","Consolidation → Sweep → Structure Break","Breaker Block → Entry with no alignment"],correct:0,why:"That is the Setup 4 flow shown in the playbook."},
{topic:"Setup 4",q:"5M and 15M point up, but 1H points down. Is Setup 4 fully aligned?",a:["Yes, because two timeframes agree","No, all three required timeframes must align","Yes, if there is a 5M gap","Yes, if risk is reduced"],correct:1,why:"Setup 4 requires 5M, 15M, and 1H to align in the same direction."},
{topic:"Setup 4",q:"All three timeframes align, but there is no 5M or 15M gap. Is the full Setup 4 present?",a:["Yes, alignment alone is enough","No, the gap component is missing","Yes, if the move is strong","Only if Setup 2 also appears"],correct:1,why:"The setup requires both multi-timeframe alignment and a valid 5M or 15M gap."},
{topic:"Setup 4",q:"What is the main difference between Setup 4 and Setups 1–3?",a:["Setup 4 is driven by 5M/15M/1H directional alignment plus a gap","Setup 4 always requires consolidation","Setup 4 always requires inducement","Setup 4 has no retrace"],correct:0,why:"Setup 4's defining condition is multi-timeframe alignment, whereas the other setups are built around different 5M confirmation structures."},
{topic:"Setup 4",q:"After the gap is filled and the entry is valid, what is expected?",a:["Continuation in the aligned direction","Automatic reversal","A mandatory liquidity sweep of inducement","No clear directional expectation"],correct:0,why:"The setup seeks continuation after the aligned retrace / gap-fill entry."},

// COMPARISON / IDENTIFICATION
{topic:"Setup Comparison",q:"Which setup is identified by a Gap/FVG or small previous Breaker Block after 5M confirmation?",a:["Setup 1","Setup 2","Setup 3","Setup 4"],correct:0,why:"Setup 1 is the Break + Gap / Breaker Block setup."},
{topic:"Setup Comparison",q:"Which setup is identified by inducement becoming liquidity and then being swept?",a:["Setup 1","Setup 2","Setup 3","Setup 4"],correct:1,why:"That inducement → liquidity sweep sequence defines Setup 2."},
{topic:"Setup Comparison",q:"Which setup is identified by consolidation → sweep → 5M Structure Break?",a:["Setup 1","Setup 2","Setup 3","Setup 4"],correct:2,why:"That sequence defines Setup 3."},
{topic:"Setup Comparison",q:"Which setup is identified by 5M, 15M, and 1H all pointing in the same direction?",a:["Setup 1","Setup 2","Setup 3","Setup 4"],correct:3,why:"Multi-timeframe alignment across 5M, 15M, and 1H is the defining feature of Setup 4."}
];

const beforeExtras=[
{topic:"Before Trade",q:"A setup matches your strategy, but the entry would require chasing price. What should you do?",a:["Enter immediately before it moves further","Wait for a valid entry or let the trade go","Increase the stop to make the entry work","Use the special-risk day"],correct:1,why:"A valid setup does not justify a poor entry. If the planned entry is gone, wait for a new valid entry or skip the trade."},
{topic:"Before Trade",q:"You know where to enter and place the stop, but the take-profit level is unclear. What is the correct action?",a:["Enter and decide the target later","Do not enter until the full trade plan is clear","Use a market order with no target","Reduce risk and enter anyway"],correct:1,why:"Entry, stop loss, take profit, and risk should all be defined before the trade is opened."},
{topic:"Before Trade",q:"You feel very confident about a setup, but one required strategy condition is missing. What should decide the trade?",a:["Your confidence","The strength of the recent trend","The written strategy rules","Your weekly profit"],correct:2,why:"Confidence cannot replace a missing strategy condition. The setup must fully match the system."},
{topic:"Before Trade",q:"Two valid setups appear at the same time. What must you check before opening both?",a:["Whether both can win","Whether the combined exposure stays within the risk rules","Whether both use the same timeframe","Whether one trade is already in profit"],correct:1,why:"Simultaneous positions must still respect the total risk and exposure limits in the Risk Management System."},
{topic:"Before Trade",q:"You are close to the weekly drawdown limit and a valid setup appears. What should be checked before entry?",a:["Whether the market is moving quickly","Whether the full trade risk could push weekly drawdown beyond -5%","Whether you can move to break-even early","Whether the target is at least 20 pips"],correct:1,why:"Weekly protection comes before the setup. No trade may be taken if its full risk could push drawdown beyond -5%."}
];

const duringExtras=[
{topic:"During Trade",q:"Price moves quickly in your favour and you feel tempted to close early just to secure profit. What should you do?",a:["Close immediately","Follow the planned exit unless there is a valid system-based reason to change it","Move the stop directly to the entry","Reduce the target by half"],correct:1,why:"A fast move does not justify fear-based or excitement-based interference. Follow the original plan."},
{topic:"During Trade",q:"Your trade is open and another trader tells you the setup is wrong. Nothing in your own system has changed. What should you do?",a:["Close because they may be right","Keep following your planned trade management","Widen the stop","Reverse the position"],correct:1,why:"An open trade should be managed according to your own pre-planned system, not outside opinions or emotion."},
{topic:"During Trade",q:"A trade is in profit but has not reached the conditions for break-even. You feel uncomfortable giving profit back. What is the correct response?",a:["Move to break-even because discomfort is enough","Keep the original stop until the break-even rule or a clear logical reason is met","Close half automatically","Move the target closer"],correct:1,why:"Discomfort is not a valid reason to move the stop. Break-even should follow the rule, not emotion."},
{topic:"During Trade",q:"The market becomes volatile after entry, but your planned SL and TP remain valid. What should you do?",a:["Change both levels because volatility increased","Follow the plan unless a valid system-based reason requires action","Remove the stop temporarily","Close because volatility always invalidates a trade"],correct:1,why:"Normal market volatility is not by itself a reason to abandon a valid pre-trade plan."},
{topic:"During Trade",q:"You keep checking the P&L and feel your decisions changing with every small move. What is the best response?",a:["React faster to each candle","Refocus on the planned trade conditions and stop managing from emotion","Increase the target","Add another position"],correct:1,why:"During the trade, decisions should come from the plan and market conditions, not from constant emotional reaction to P&L."}
];

const goodPerformanceExtras=[
{topic:"Good Performance State",q:"You have had your best week in months. A setup is only partially valid. What should you do?",a:["Take it because your judgement is clearly strong","Skip it because the setup does not fully meet the system","Take it with 2% risk","Take it and use a wider stop"],correct:1,why:"Strong recent performance does not reduce the standard required for a valid setup."},
{topic:"Good Performance State",q:"After several wins, you feel that normal risk is too conservative. What should you do?",a:["Increase risk while confidence is high","Keep the same risk model","Double risk only on familiar setups","Use profit as extra risk capital"],correct:1,why:"Winning performance does not justify increasing risk. The fixed-risk model remains unchanged."},
{topic:"Good Performance State",q:"You are on a winning streak and see more setups than usual. What should determine whether you trade them?",a:["The desire to maximise the streak","Whether each setup independently meets the system","How much profit you already made","How confident you feel"],correct:1,why:"Every trade must still qualify independently. A winning streak is not permission to overtrade."},
{topic:"Good Performance State",q:"A large profit makes you feel that one small rule break will not matter. What is the correct response?",a:["Allow it because the week is already profitable","Follow every rule exactly as you would in a neutral performance state","Reduce the stop instead","Use the profit cushion to experiment"],correct:1,why:"Profit does not make rule-breaking acceptable. Discipline should remain unchanged in a good performance state."},
{topic:"Good Performance State",q:"What is the main psychological objective after a strong run of profitable trades?",a:["Become more aggressive","Protect the same decision process from overconfidence","Find more trades","Raise the weekly target"],correct:1,why:"The goal is to preserve the same disciplined process and prevent overconfidence from changing behaviour."}
];

function sectionQuestions(name){
  if(name==="Before Trade") return [...bank.filter(q=>q.topic==="Before Trade"),...beforeExtras];
  if(name==="During Trade") return [...bank.filter(q=>q.topic==="During Trade"),...duringExtras];
  if(name==="Good Performance State") return [...bank.filter(q=>q.topic==="Good Performance State"),...goodPerformanceExtras];
  if(name==="After Trade"){
    const losses=bank.filter(q=>q.topic==="After Loss").slice(0,8);
    const wins=bank.filter(q=>q.topic==="After Win").slice(0,7);
    return [...losses,...wins].map(q=>({...q,displayTopic:"After Trade"}));
  }
  if(name==="All Setups Quiz") return [...setupBank];
  return [];
}

let mode="all",questions=[],idx=0,score=0,answered=false,topicScore={},currentSection=null;
const $=id=>document.getElementById(id);
const screens=[$("home"),$("setupsReference"),$("quiz"),$("result")];

function show(s){screens.forEach(x=>x.classList.remove("active"));s.classList.add("active");window.scrollTo({top:0,behavior:"smooth"})}
function shuffle(a){const c=[...a];for(let i=c.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[c[i],c[j]]=[c[j],c[i]]}return c}

function renderTopics(){
  const setupReference=`<button class="training-topic-card training-reference-card-launch" id="setupsReferenceBtn"><div class="training-card-top"><strong>Setups</strong><span class="training-count">REFERENCE</span></div><span>Open the Trading Setup Rules visual playbook, full Setup 1–4 rules, flows, and main differences.</span></button>`;
  $("topics").innerHTML=setupReference+practiceSections.map((t,i)=>{const count=t.name==="All Setups Quiz"?setupBank.length:15;return `<button class="training-topic-card" data-section="${t.name}"><div class="training-card-top"><strong>${i+1}. ${t.name}</strong><span class="training-count">${count} QUESTIONS</span></div><span>${t.desc}</span></button>`}).join("");
  $("setupsReferenceBtn").addEventListener("click",()=>show($("setupsReference")));
  document.querySelectorAll("[data-section]").forEach(btn=>btn.addEventListener("click",()=>startSection(btn.dataset.section)));
}

function resetSession(){idx=0;score=0;answered=false;topicScore={};topics.forEach(t=>topicScore[t.name]={correct:0,total:0})}

function startSection(name){mode="section";currentSection=name;resetSession();questions=shuffle(sectionQuestions(name));show($("quiz"));renderQuestion()}
function startAll(){mode="all";currentSection=null;resetSession();questions=shuffle(bank);show($("quiz"));renderQuestion()}

function renderQuestion(){
  answered=false;$("feedback").classList.add("hidden");
  const item=questions[idx];
  $("counter").textContent=`QUESTION ${idx+1} OF ${questions.length}`;
  $("bar").style.width=`${((idx+1)/questions.length)*100}%`;
  $("topicBadge").textContent=item.displayTopic||item.topic;
  $("question").textContent=item.q;$("answers").innerHTML="";
  item.a.forEach((ans,i)=>{const b=document.createElement("button");b.className="training-answer";b.innerHTML=`<span class="training-letter">${String.fromCharCode(65+i)}</span><span>${ans}</span>`;b.onclick=()=>choose(i);$("answers").appendChild(b)})
}

function choose(i){
  if(answered)return;answered=true;
  const item=questions[idx],buttons=[...document.querySelectorAll("#answers .training-answer")];
  if(topicScore[item.topic])topicScore[item.topic].total++;
  if(i===item.correct){score++;if(topicScore[item.topic])topicScore[item.topic].correct++}
  buttons.forEach((b,n)=>{b.disabled=true;if(n===item.correct)b.classList.add("correct");if(n===i&&n!==item.correct)b.classList.add("wrong")});
  $("feedbackTitle").textContent=i===item.correct?"Correct":"Not the best answer";
  $("explanation").textContent=item.why;$("feedback").classList.remove("hidden");
  $("nextBtn").textContent=idx===questions.length-1?"View Results":"Next Question"
}

function next(){if(!answered)return;if(idx<questions.length-1){idx++;renderQuestion()}else finish()}

function finish(){
  $("score").textContent=`${score}/${questions.length}`;
  const pct=score/questions.length;
  if(pct===1){$("resultHeading").textContent="Perfect session.";$("resultText").textContent="You answered every scenario correctly. Carry the same discipline into live execution."}
  else if(pct>=.8){$("resultHeading").textContent="Strong session.";$("resultText").textContent="Review the questions you missed and reinforce the response your system requires."}
  else{$("resultHeading").textContent="Keep practising.";$("resultText").textContent="The goal is not only a high score. The goal is to make the correct response automatic under pressure."}

  if(mode==="section")$("topicBreakdown").innerHTML=`<div class="training-break-item"><strong>${currentSection}</strong><br><span>${score}/${questions.length} correct</span></div>`;
  else $("topicBreakdown").innerHTML=topics.map(t=>{const d=topicScore[t.name];if(!d.total)return"";return`<div class="training-break-item"><strong>${t.name}</strong><br><span>${d.correct}/${d.total} correct</span></div>`}).join("");

  localStorage.setItem("tradeflow_training_last_session_v1",JSON.stringify({mode,currentSection,score,total:questions.length,date:new Date().toISOString()}));
  show($("result"))
}

$("fullBtn").onclick=startAll;
$("exitBtn").onclick=()=>show($("home"));
$("nextBtn").onclick=next;
$("againBtn").onclick=()=>mode==="section"?startSection(currentSection):startAll();
$("homeBtn").onclick=()=>show($("home"));
renderTopics();

window.TradeFlowTraining={home:()=>show($("home")),startAll,startSection};


// Setups reference page — static training content only.
["setupsBackBtn","setupsBackBottomBtn"].forEach(id=>{const el=$(id);if(el)el.addEventListener("click",()=>show($("home")))});
document.querySelectorAll("[data-setup-target]").forEach(btn=>btn.addEventListener("click",()=>{const target=document.getElementById(btn.dataset.setupTarget);if(target)target.scrollIntoView({behavior:"smooth",block:"start"})}));
const setupModal=$("setupImageModal"),setupOpen=$("setupImageOpen"),setupClose=$("setupImageClose");
function openSetupImage(){setupModal.classList.add("open");setupModal.setAttribute("aria-hidden","false");document.body.classList.add("setup-modal-open");setupClose.focus()}
function closeSetupImage(){setupModal.classList.remove("open");setupModal.setAttribute("aria-hidden","true");document.body.classList.remove("setup-modal-open");setupOpen.focus()}
if(setupOpen)setupOpen.addEventListener("click",openSetupImage);
if(setupClose)setupClose.addEventListener("click",closeSetupImage);
if(setupModal)setupModal.addEventListener("click",e=>{if(e.target===setupModal)closeSetupImage()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&setupModal&&setupModal.classList.contains("open"))closeSetupImage()});
