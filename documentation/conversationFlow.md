```mermaid
sequenceDiagram

actor citizen
participant user bot
participant checker bot
actor checker

citizen ->> user bot: {fake news}
alt there is a match
    alt vote not completed
        user bot ->> citizen: Hello! 👋 Thank you for sending this in! Our *CheckMates🕵🏻 will be reviewing this message* and *providing you with the results soon*.
    else is a scam
        user bot ->> citizen: ⛔⛔ Thank you for waiting! Our CheckMates have reviewed the message and think this is likely to be a *scam*!🚫\n\nWe recommend you do not engage further⛔️\n\nThank you for keeping Singapore safe!
    else is suspicious
		user bot ->> citizen: ⛔⛔ Thank you for waiting! Our CheckMates have reviewed the message and think this *looks suspicious*!🚨\n\nWe recommend you do not engage further⛔️\n\nThank you for keeping Singapore safe!
	else truth score 0-1.5
        user bot ->> citizen: ⛔⛔ Thank you for waiting! Our CheckMates have reviewed the message and think it's *likely to be untrue*.❌\n\nPlease do not spread it further⛔️\n\nThank you for keeping Singapore informed!
    else truth score 1.5-3.5
        user bot ->> citizen: 🚧🚧 Thank you for waiting! Our CheckMates have reviewed the message and think that *while some elements within could be true, it's presented in a misleading way*.⚠️\n\nPlease take it with a pinch of salt and think twice before spreading it further🚧.\n\nThank you for keeping Singapore informed!
    else truth score 3.5-5
        user bot ->> citizen: ✅✅ Thank you for waiting! Our CheckMates have reviewed the message and think that it's *accurate*.✅\n\nThank you for keeping Singapore informed!
    else irrelevant
        user bot ->> citizen: Thank you for waiting! Our CheckMates have reviewed the message and think it's *harmless*.👌
    end
else no match
    user bot ->> citizen: Hello! 👋 Thank you for sending this in! Our CheckMates🕵🏻 will be reviewing this message and providing you with the results soon.
    checker bot ->> checker: Hi {name}, CheckMate has received a new message. Would you like to help to assess it? <Yes><No>
    alt yes
        checker ->> checker bot: yes
        checker bot ->> checker: {actual message or image received}
        checker bot ->> checker: Is this message a scam, i.e. an attempt to trick someone into giving away their money or personal information, or is it something else? <It's a scam> <It's something else>
        alt scam
            checker ->> checker bot: It's a scam
            checker bot ->> checker: Got it! Your response has been recorded. Thank you for playing your part in the fight against scams and misinformation, one message at a time! 💪
        else not scam
            checker ->> checker bot: It's something else
            checker bot ->> checker: Got it👍! Please hold for another poll to vote on how true the message is.
            checker bot ->> checker: Please vote on the new message above. If there is no claim in the message, select 'No Claim Made'. Otherwise, assess the veracity of the claim(s) on a scale from 0 to 5, where 0 means the claims(s) are entirely false, and 5 means the claims(s) are entirely true.
            checker ->> checker bot: {selected option from list message}
            checker bot ->> checker: Got it! Your response has been recorded. Thank you for playing your part in the fight against scams and misinformation, one message at a time! 💪
        end
    else no
        checker ->> checker bot: no
        checker bot ->> checker: No problem! If you wish to come back and assess the message, you may do so by clicking the "yes" button. See you soon!😊
    end

end
```
