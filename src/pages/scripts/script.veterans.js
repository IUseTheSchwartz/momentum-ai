// src/pages/scripts/script.veterans.js
// FULL VERBATIM SCRIPT (from your paste)

const SCRIPT = [
  // ===== INTRO =====
  { id: "h_intro", type: "line", spoken: false, text: "INTRO" },

  {
    id: "intro_1",
    type: "line",
    text:
      "Hey (client name)(PAUSE) , this is (your name) I was just giving you a quick call from the BENEFITS FOR VETERANS OFFICE. How are you doing today???",
  },
  {
    id: "intro_2",
    type: "line",
    text:
      "This call is in regards to the request you submitted, for that new Final Expense and Life options for Veterans. I’m the medical underwriter assigned to your file.",
  },
  { id: "intro_3", type: "line", text: "I have your DOB listed here as ___. Is that correct?" },
  {
    id: "intro_4_note",
    type: "line",
    spoken: false,
    text:
      "It shows here, you're a (Veteran, MARINE, NAVY, ARMY ETCC… USE WHAT IT SAYS IN EXCEL… IF IT SAYS RETIRED SAY VETERAN) .",
  },
  { id: "intro_5", type: "line", text: "Thank you for your service." },
  {
    id: "intro_6",
    type: "line",
    text:
      "Now, what was your main concern….. Like most Veterans, just want  to make sure that the Funeral Expense doesn’t fall a burden on your loved ones.",
  },
  {
    id: "intro_7",
    type: "line",
    text:
      "Got it; now, were you also looking to try and leave something extra behind as well if possible?",
  },

  // ===== BRANCH: EARLY OBJECTIONS (AGENT RESPONSE CHOICE) =====
  {
    id: "branch_early_objections",
    type: "branch",
    options: [
      {
        label: "Coverage objection path",
        triggers: [
          "perfect did you get this taken care of through the va",
          "perfect did you get this taken care of through the va",
          "perfect did you get this taken care of through the va",
        ],
        next: "cov_1",
      },
      {
        label: "Dont remember path",
        triggers: [
          "perfect i usually dont remember what i eat for breakfast most days",
          "perfect i usually dont remember what i eat for breakfast",
          "perfect i usually dont remember",
        ],
        next: "dont_1",
      },
    ],
  },

  // ===== “I already have coverage in place!” =====
  { id: "cov_h", type: "line", spoken: false, text: "“I already have coverage in place!”" },
  {
    id: "cov_h2",
    type: "line",
    spoken: false,
    text: "1ST APPROACH. PERFECT DID YOU GET THIS TAKEN CARE OF THROUGH THE VA….",
  },
  { id: "cov_1", type: "line", text: "PERFECT DID YOU GET THIS TAKEN CARE OF THROUGH THE VA…." },
  {
    id: "cov_2",
    type: "line",
    text:
      "Perfect that actually makes my job a whole lot easier. Veterans who have a life insurance policy leave it for a legacy left behind(left over money) your main goal is to make sure your funeral expense was taken care of through the VA CORRECT?",
  },
  {
    id: "cov_3",
    type: "line",
    text:
      "I UNDERSTAND WHEN YOU SENT IN THIS REQUEST WHERE YOU LOOKING TO GET A DISCOUNT THROUGH THE VA OR ADD MORE COVERAGE",
  },
  { id: "cov_4", type: "line", text: "WHAT WAS THE MAIN REASON YOU SUBMITTED THE REQUEST IN THE FIRST PLACE THEN" },

  // ===== “I don’t remember filling this out!” =====
  { id: "dont_h", type: "line", spoken: false, text: "I don’t remember filling this out!”" },
  {
    id: "dont_1",
    type: "line",
    text:
      "Perfect, I usually don’t remember what I eat for breakfast most days. You put your date of birth as ___ correct?",
  },
  {
    id: "dont_2",
    type: "line",
    text:
      "Now, most people’s main concern when they fill this out is to make sure that their final expense doesn’t fall a burden on their loved ones or leave some extra money behind. Do you currently have anything in place?” Then go back to the script…",
  },

  // ===== Client Suitability Sheet =====
  { id: "h_css", type: "line", spoken: false, text: "Client Suitability Sheet" },
  {
    id: "css_1",
    type: "line",
    text:
      "So what we’ll do is spend about a minute or so on yourself and your financial situation to make sure everything is affordable and within the budget. NOW Typically we don’t have a problem because these were designed for Veterans on a fixed income.. like social security and the disability.",
  },
  {
    id: "css_2",
    type: "line",
    text:
      "Then we’ll spend about 2 minutes on your health.. and that will help me navigate which one of the 26 VA A rated carriers would most likely give you the approval today.",
  },
  { id: "css_3", type: "line", text: "Okay sir/mam?" },
  { id: "css_why", type: "line", spoken: false, text: "DIG INTO WHY!!!" },

  // WHY Qs
  {
    id: "why_1",
    type: "line",
    text:
      "Now god forbid, if you were to pass away today who would be the beneficiary responsible paying for the funeral expenses & picking up all the pieces tomorrow?",
  },
  { id: "why_2", type: "line", text: "What is their name? Also, relationship to you, how old is (beneficiaries name)?" },
  {
    id: "why_3",
    type: "line",
    text:
      "Is (beneficiary name) in a financial position to cover a funeral expense or is that why you were looking into this?",
  },
  {
    id: "why_4",
    type: "line",
    text:
      "I completely understand, that's why most veterans do send in these requests. So their loved ones aren’t burdened with that expense.",
  },
  { id: "why_5", type: "line", text: "Have you thought about whether you were to be buried or cremated?" },
  { id: "why_6", type: "line", text: "Do you know how much that costs nowadays?!" },
  { id: "why_7", type: "line", text: "● Cremation: 5-7k depending on the celebration/urn." },
  { id: "why_8", type: "line", text: "● Burial: 15-20k depending on the fanciness of the service & the opening/closing." },
  {
    id: "why_9",
    type: "line",
    text:
      "Do you have anything put aside somewhere in a significant savings or do you have a life insurance policy that would cover that cost God Forbid something were to happen to you today?",
  },

  // Agent notes about NO vs HAS coverage (display only)
  { id: "h_agent_1", type: "line", spoken: false, text: "For Agent:" },
  {
    id: "agent_no_1",
    type: "line",
    spoken: false,
    text:
      "If NO: So since you don’t have anything as of today to cover those final expenses, your goal is to put your family in a situation where you don’t leave a financial burden behind when you do pass away correct?",
  },
  {
    id: "agent_yes_1",
    type: "line",
    spoken: false,
    text:
      "If they already have coverage: If you don't mind me asking.. What kind of coverage do you have in place already? are you thinking about getting more coverage in place? Did you have anyone pass away on you recently or were just thinking you don't have enough coverage in place? REPEAT THE CONCERN!!",
  },

  // ===== Income =====
  { id: "h_income", type: "line", spoken: false, text: "Income:" },
  { id: "inc_1", type: "line", text: "Now are you currently working, retired, or disabled?" },
  { id: "inc_ret", type: "line", spoken: false, text: "IF retired: I can’t wait to say that one day!" },
  { id: "inc_dis", type: "line", spoken: false, text: "IF disabled: Bless your heart!" },
  { id: "inc_2", type: "line", text: "What would you say you bring in per month just to the ballpark?" },
  {
    id: "inc_3",
    type: "line",
    text:
      "At the end of month once you pay all your bills, utilities, and all the fun things you like to do. How much would you say you are typically left with?",
  },

  // Low income script (spoken)
  { id: "h_low", type: "line", spoken: false, text: "For Agent- Little to No Income left over! ($200 or under)" },
  {
    id: "low_1",
    type: "line",
    text:
      "I completely understand, so that being said, what would be a comfortable amount that you would be comfortable allocating into something like this every month to protect your loved ones would that be $50,$75, or $100?",
  },
  {
    id: "low_2",
    type: "line",
    text:
      "Push Back #2: Do you mind if I make a recommendation.. I would say some coverage is better than no coverage to alleviate that financial burden. So we can always start with the lowest option available then increase when times get better. If you can't afford $50-$75/mo how do you expect “Beneficiaries Name” to afford that entire funeral expense.. Does that make sense?",
  },

  // Discounts
  { id: "h_disc", type: "line", spoken: false, text: "There's two DISCOUNTS you may qualify for:" },
  { id: "disc_1", type: "line", text: "Are you a smoker or Nonsmoker?" },
  {
    id: "disc_2_note",
    type: "line",
    spoken: false,
    text: "If smoker: Do you plan on quitting anytime soon over the next couple years? Absolutely. Yes- AMERICO",
  },
  { id: "disc_3", type: "line", text: "AND DO YOU BANK WITH A Federal bank or military branch credit union?" },
  { id: "disc_4", type: "line", text: "WHATS THE NAME OF IT ?" },

  // Branch: "Why do you need to know that?" (agent response)
  {
    id: "branch_discount_bank_objection",
    type: "branch",
    options: [
      {
        label: "Discount bank objection response",
        triggers: [
          "yes its so we can apply the second discount for you",
          "its so we can apply the second discount",
        ],
        next: "disc_ob_1",
      },
    ],
  },
  { id: "disc_ob_h", type: "line", spoken: false, text: "OBJECTION: WHY DO YOU NEED TO KNOW THAT?" },
  {
    id: "disc_ob_1",
    type: "line",
    text:
      "YES, IT'S SO WE CAN APPLY THE SECOND DISCOUNT FOR YOU IF YOU BANK WITH FEDERAL BANK OR MILITARY BRANCH CREDIT UNION. WHICH ONE WAS IT FOR YOU?",
  },

  // ===== HEALTH (verbatim) =====
  { id: "h_health", type: "line", spoken: false, text: "Now a little bit on your health…….." },
  { id: "h_health_3", type: "line", spoken: false, text: "3" },
  {
    id: "med_1",
    type: "line",
    text:
      "Now, for all of your medical needs, do you go to the VA or a civilian doctor? **Are all of your prescriptions prescribed through the VA or a civilian doctor?",
  },
  {
    id: "med_2",
    type: "line",
    text:
      "Any heart attacks, heart failure, strokes, TIA, or stints in the last 5 yrs? If yes: Are you currently on any blood thinners or heart medications?",
  },
  { id: "med_3", type: "line", text: "If yes: Any Blood thinners: Plavix or warfarin?" },
  { id: "med_4", type: "line", text: "If yes: Any Heart Medications: Nitrostat, nitroglycerin, eliquis?" },
  {
    id: "med_5",
    type: "line",
    text:
      "Any cancer in the last 5 years? What kind? How long have you been in remission? (that means cancer free)",
  },
  { id: "med_6", type: "line", text: "Any diabetes? If yes: Are you on metformin or insulin?" },
  { id: "med_7", type: "line", text: "Any neuropathy? If yes: are you taking gabapentin?" },
  {
    id: "med_8",
    type: "line",
    text:
      "Any high blood pressure? If yes: are you taking lisinopril, metoprolol, or amlodipine OR LASARTIN",
  },
  { id: "med_9", type: "line", text: "Any breathing complications, or COPD? If yes: Are you taking oxygen OR INHAILER?" },
  { id: "med_10", type: "line", text: "Any anxiety or depression? If yes: Are you taking prozac or seroquel?" },
  { id: "med_11", type: "line", text: "Any Kidney or liver problems? If yes to kidney: Any kidney failure/disorder or dialysis?" },
  { id: "med_12", type: "line", text: "Any hospitalizations in the last year for 48 hours or more?" },
  { id: "med_13", type: "line", text: "Then one last thing.. a rough height and weight for you?" },

  // Punch into system note
  {
    id: "note_punch",
    type: "line",
    spoken: false,
    text:
      "**Bare with me for 1-2 minutes as I punch all this information into our state system  HAS RECOMMENDED FOR you. (JUST DO THE BRONZE NUMBERS AND YOU WILL DO THE REST LATER)",
  },

  // ===== Before presenting numbers =====
  { id: "h_before_numbers", type: "line", spoken: false, text: "BEFORE Presenting Numbers:" },
  {
    id: "bn_1",
    type: "line",
    text:
      "Now before we go over the packages I’m going to explain how the process works ALRIGHT…..  SO it’s not like going to your local grocery store...where you just see it, like it, buy it. With this kind of thing we have to get approved for it, the carriers will look at what’s called the medical information bureau, it’s the MIB report. It’s a compilation of your medical records,hospitalizations, prescriptions over the last few years.",
  },
  {
    id: "bn_2",
    type: "line",
    text:
      "We can’t make our final decision right away because it’s up to the carrier if they want to approve you,Which is why we spent a little bit of time on your health.",
  },

  // ===== Credentials =====
  { id: "cred_h", type: "line", spoken: false, text: "CREDENTIALS- Do you receive text messages to this phone number?" },
  {
    id: "cred_1",
    type: "line",
    text:
      "Now do you receive text messages on this phone? Perfect, there’s a new protocol here in the state, I legally have to send over a copy of my Department of Insurance License, so that you have it for your records. Due to all the shenanigans going on. You should be receiving a picture of my license.. It's going to contain my full name, my NPN # which is like my employee social security number, and in the top left there’s a picture of me so you know the face behind the voice. It will be coming in from a (Your Area Code) number let me know when you receive that!",
  },

  // ===== Benefits =====
  {
    id: "benef_h",
    type: "line",
    text:
      "Benefits- Can you grab a Pen/Paper for me…? I'm gonna give you some information about the benefits that come with this type of plan specifically for our Veterans.",
  },
  {
    id: "benef_1",
    type: "line",
    text:
      "Write down Immediate coverage: That means as soon as you make your first premium you’re covered day 1, no 2 year wait period like most carriers!",
  },
  { id: "benef_2", type: "line", text: "Write down Locked in: Premiums never increase and coverage never decreases!" },
  {
    id: "benef_3",
    type: "line",
    text:
      "Write down TAX-FREE: The death benefit, living benefit, and cash value are one of the few things we don’t have to pay Uncle Sam for!",
  },
  {
    id: "benef_4",
    type: "line",
    text:
      "Write down Living benefit: This one is important, IF you get a terminal illness, and the doctor tells you that you have 12-24 months to live you’ll have access to 50% of the benefit tax free while you’re still living!",
  },
  { id: "benef_5", type: "line", text: "Write down Cash value: Your policy will accumulate cash value over time." },
  {
    id: "benef_6",
    type: "line",
    text:
      "Write down Double Accidental PayOut: If your cause of death is choke, drown, slip, fall, or die in a car accident your coverage would double. That’s just like an accidental; it's something included in your policy as well.",
  },
  { id: "benef_7", type: "line", text: "Lastly, Write down Permanent coverage: This coverage will never expire on you.. it is a whole life policy." },

  // ===== Quote =====
  { id: "quote_h", type: "line", spoken: false, text: "Quote" },
  {
    id: "quote_1",
    type: "line",
    text:
      "Based on what you’ve told me the system has built 3 packages of coverage and you can decide on which option makes the most sense but keep in mind we can adjust as you please. Because the goal here is to find the right amount of coverage, for the best premium  but at the end of the day we will still have to get it approved. Does that make sense sir/mam?",
  },
  { id: "quote_2", type: "line", text: "Can you write down for me GOLD, SILVER, AND BRONZE." },
  {
    id: "quote_3",
    type: "line",
    text:
      "The BRONZE option will cover a basic funeral expense as long as it's not on the fancy end but won’t leave money behind for “Beneficiaries Name”. That will be (Coverage Amount) for ______/a month.",
  },
  {
    id: "quote_4",
    type: "line",
    text:
      "The SILVER option, this is the option most veterans lean towards and that will cover the FULL COST + factor inflation in the future so “Beneficiaries Name” doesn’t have to be burdened by any of the expenses whatsoever.. and that will be (Coverage Amount) for ______/ a month.",
  },
  {
    id: "quote_5",
    type: "line",
    text:
      "The GOLD option is going to guarantee to cover the FULL COST of the funeral and leave some money behind for “Beneficiaries Name”.. and that will be (Coverage Amount) for ______/a month.",
  },
  {
    id: "golden_q",
    type: "line",
    text:
      "Golden Question:  GIVEN THOSE THREE OPTIONS THE GOLD, SILVER AND BRONZE KEEP IN MIND THE GOLD COVERAGE THE FULL COST BUT LEAVES MONEY BEHIND, THE SILVER IS WHAT MOST VETERANS GO WITH BECAUSE IT FACTORS INFLATION AND THE BRONZE OPTION WILL GIVE UP THE PEACE OF MIND AND COVER THE FUNERAL COVERAGE…. WHICH ONE WOULD MAKE THE MOST SENSE FOR YOU?",
  },

  // ===== Phase II: Numbers Objections =====
  { id: "phase2_h", type: "line", spoken: false, text: "Phase II: Numbers Objections" },
  {
    id: "branch_numbers",
    type: "branch",
    options: [
      {
        label: "Think about it objection path",
        triggers: [
          "i completely understand did you want to think about if you needed the coverage at all",
          "i completely understand did you want to think about",
        ],
        next: "think_1",
      },
      {
        label: "Talk to wife objection path",
        triggers: [
          "i completely understand she is the beneficiary of the plan",
          "i completely understand she is the beneficiary",
        ],
        next: "wife_1",
      },
    ],
  },
  { id: "think_h", type: "line", spoken: false, text: "“I need to think about it!”" },
  {
    id: "think_1",
    type: "line",
    text:
      "I completely understand, did you want to think about if you needed the coverage at all or which coverage amount you should go with?",
  },
  {
    id: "think_2",
    type: "line",
    text:
      "If which one: Let’s start with bare minimum, make sure you can get the approval and foot in the door and that it’s comfortable and affordable. Then we can always increase it in the future. Does that make sense? So to get started on the app (proceed to script).",
  },

  { id: "wife_h", type: "line", spoken: false, text: "“I need to talk to my wife about this!”" },
  {
    id: "wife_1",
    type: "line",
    text:
      "Push Back 1: I completely understand. She is the beneficiary of the plan, and she has to know what’s going on. You can’t keep this a secret that’s for sure. Do you need to talk to her about which one to go with or if you should even do this, because you said that this was to protect her, correct?",
  },
  {
    id: "wife_2",
    type: "line",
    text:
      "Push Back 2: (client name), do you mind if I make a recommendation? Now, we can both agree that accidents can occur at any time, right? Now if something happened to you while driving on the way home tomorrow.. And you had put this protection in place for your wife on possibly her worst day. Do you think that she would be mad at you?",
  },

  // ===== Start Application =====
  { id: "app_h", type: "line", spoken: false, text: "START APPLICATION:" },
  {
    id: "app_1",
    type: "line",
    text:
      "Perfect, now we’ll send in a request for coverage and hope to get the approval, now if they decline you we’ll go to the next lowest option. Keep in mind they don’t approve everyone but I will do my best to get you the coverage ok. I’ll be confirming basic information, asking you some similar medical questions that I know the answers to already.. but i'm just required to ask you for the carrier record by law, then we will be listing the beneficiary, and choosing the effective date. Does that make sense?",
  },
  {
    id: "app_2",
    type: "line",
    text:
      "Golden Question: Always ask this question when going into the application… Now, is this something you’ve been thinking about for awhile?",
  },

  { id: "app_first_h", type: "line", spoken: false, text: "First page of application:" },
  { id: "app_first_1", type: "line", text: "Confirm spelling first/last name as it appears on your driver's license" },
  { id: "app_first_2", type: "line", text: "Height/weight again?" },
  { id: "app_first_3", type: "line", text: "if the policy was to be approved? Mailing address (house or apartment?!)" },
  { id: "app_first_4", type: "line", text: "What good Phone numbers can we put on the application?" },
  { id: "app_first_5", type: "line", text: "What's a good Email on file?" },
  { id: "app_first_6", type: "line", text: "What State were you born in?" },
  {
    id: "app_first_7",
    type: "line",
    text:
      "AND YOU'RE Obviously a US CitIZEN CORRECT? (Jokingly, laugh and say i was answering that one for you)",
  },
  {
    id: "app_first_8",
    type: "line",
    text: "And, your social (client first name)? For Agent: HAVE CLIENT REPEAT IT BACK FOR CONFIRMATION",
  },

  // Branch: Social Security Objection (agent pushback)
  {
    id: "branch_ssn_objection",
    type: "branch",
    options: [
      {
        label: "SSN pushback #1",
        triggers: [
          "i completely understand now the main reason they ask for that piece of information",
          "i completely understand the main reason they ask",
        ],
        next: "ssn_1",
      },
    ],
  },
  { id: "ssn_h", type: "line", spoken: false, text: "Social Security Objection:" },
  {
    id: "ssn_1",
    type: "line",
    text:
      "Push Back #1: I completely understand, now the main reason they ask for that piece of information.. Is because that is the only way they will identify you for the MEDICAL INFORMATION BUREAU, and when you pass away that will be the only thing on your death certificate so your loved ones will get paid out on it.",
  },
  { id: "ssn_pic", type: "line", spoken: false, text: "*****TEXT Picture of Application*****" },

  { id: "app_validate_1", type: "line", text: "Perfect… Now what they are gonna do is just validate your identity and make sure you're not a robot or anything… *laugh* Obviously you’re not, we are on the phone right now!" },

  { id: "app_proc_h", type: "line", spoken: false, text: "Process with application:" },
  { id: "app_proc_1", type: "line", spoken: false, text: "Answer all medical questions as given" },
  { id: "app_proc_2", type: "line", spoken: false, text: "List beneficiary" },

  // ===== Lining Up Banking =====
  { id: "bank_h", type: "line", spoken: false, text: "Lining Up Banking:" },
  { id: "bank_word_h", type: "line", spoken: false, text: "Immediate Draft Word Track: (ONLY- If left over income is high)" },
  { id: "bank_0", type: "line", text: "Hey (client name) the next part here is the state's anti money laundering verification..." },
  {
    id: "bank_1",
    type: "line",
    text:
      "If the policy is to be approved, when would you like for it to go into effect.. Most people like for it to go into effect immediately since it’s day 1 coverage. WOULD THAT BE THE SAME FOR YOU?  (chuckle)",
  },
  {
    id: "bank_2",
    type: "line",
    text:
      "IF Immediately: The first premium typically drafts in 24-48 hours. Is that gonna be fine? Is the (DAY) of every month gonna be fine for you moving forward or would you want it to be like most veterans with your SSI billing date? (Push for making recurring to SSI Billing Date)",
  },
  {
    id: "bank_3",
    type: "line",
    text:
      "pushed back.. no problem, it actually looks like you qualify for social security billing for it to be drafted in accordance to that date just like other veterans…whether it’s 1st, 3rd of the month, or 3rd or 4th Wednesday of the month. Which one is when you receive your SSI?",
  },
  { id: "bank_4", type: "line", text: "Is your name as it appears with your financial institution?" },
  {
    id: "bank_5",
    type: "line",
    text:
      "It looks like we are partnered with “name of bank” in our state system. 9/10 times the routing number that automates is correct. Do you have a checkbook to confirm it?  IT SHOULD START WITH…..xxxx ( WHATEVER POPULATES FOR YOU ON GOOGLE PLEASE PUT IN FOR EXAMPLE NAVY FEDERAL IN LA ROUTING NUMBER)",
  },
  { id: "bank_6", type: "line", text: "And your account number - confirm it 2x" },

  // Branch: Banking objections
  {
    id: "branch_banking_objections",
    type: "branch",
    options: [
      {
        label: "Bank Push Back #1",
        triggers: [
          "i completely understand now quick question",
          "i completely understand now quick question clients name",
        ],
        next: "bank_ob_1",
      },
      {
        label: "Bank Push Back #2",
        triggers: [
          "i completely understand so the state is required by law to validate that information",
          "i completely understand the state is required by law",
        ],
        next: "bank_ob_2",
      },
      {
        label: "Bank Push Back #3 Checkmate",
        triggers: [
          "no worries we can just add the card on file for now",
          "no worries we can just add the card on file",
        ],
        next: "bank_ob_3",
      },
    ],
  },

  { id: "bank_ob_h", type: "line", spoken: false, text: "Bank Objection:" },
  {
    id: "bank_ob_1",
    type: "line",
    text:
      "Push Back #1: I completely understand, now quick question (Client’s Name): have you ever given or received a check from anyone in your lifetime? Perfect, if you notice at the bottom of every check you’ll see the bank's routing and account number because that information can’t be used to buy something online or go to your local Walmart and go on a shopping spree OK? What would be weird is if I would’ve asked you for something like a debit/credit card which is an unsecured payment method. Does that make sense?",
  },
  {
    id: "bank_ob_2",
    type: "line",
    text:
      "Push back #2: Why do I have to give you that now? I completely understand, so the state is required by law to validate that information provided is linked to your name for your safety and the safety of others. Does that make sense? Go ahead with your account number.",
  },
  { id: "bank_no_checkbook", type: "line", text: "No Checkbook: Question 1- Do you get your statements via mail or email or Do you do online banking? OKAY GO AHEAD AND PULL IT UP FROM THERE" },
  { id: "bank_pb3_h", type: "line", spoken: false, text: "PUSH BACK #3 **IF THEY DON'T HAVE CHECKBOOK OR FIND BANK STATEMENT OR FIND ACCT #”" },
  {
    id: "bank_ob_3",
    type: "line",
    text:
      "CHECKMATE!!:“No worries, we can just add the card on file for now and update it later. Go ahead with the card you want to put on file. (Ask if Visa or mastercard, write down card number, ask for expiration month/yr, and 3 digit CVV on back). MAKE THEM REPEAT IT TWICE. THEN PIVOT TO AIG SIWL FIRST THEN PROSPERITY IF NEEDED. WRITE DOWN ALL INFO AND PROCEED WITH APP.",
  },

  // ===== After Closing Policy =====
  { id: "after_h", type: "line", spoken: false, text: "After Closing Policy:" },
  {
    id: "after_1",
    type: "line",
    text:
      "So (client name), everything is fully submitted and approved at this point. Couple things to recap, the coverage we applied for was for ($$$)  Also, this number we are talking on, this is my direct line, it’s the same number my mom calls me on. Anything you ever need in regards to this coverage, I’m always the first person you can reach out to, I’m just a phone call or text away ok.",
  },
  {
    id: "after_2",
    type: "line",
    text:
      "Lastly, this is important, we always contact the department of insurance in the state and let them know that we have completed the request and submitted an application. The reason we do that is because it should remove you from any kind of lists of solicitations about this coverage. No one will ever contact you about this coverage other than myself or the carrier asking you for any personal information ok. With the internet these days you will still probably get some calls but none will be anything in regard to what we did. So if they say they’re my manager, it’s incomplete, due for review, etc etc it’s just a line of crap from some telemarketer trying to pull a fast one on you ok. We know this coverage is important for you and I don’t want to see some random person mess up the coverage for your family alright? LASTLY, was I service to you and your loved ones?",
  },

  // ===== Closing Line =====
  { id: "close_h", type: "line", spoken: false, text: "CLOSING LINE:" },
  {
    id: "close_1",
    type: "line",
    text:
      "Perfect now, look out for that policy in the mail; typically it takes 10-12 business days. Also, I'll be sending you a text message so you can save my number! Are there any questions or concerns I may have left unanswered? I appreciate you allowing me to serve you. LASTLY, was I service to you and your loved ones?",
  },
];

export default SCRIPT;
