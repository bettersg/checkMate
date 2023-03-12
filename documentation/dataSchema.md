erDiagram

    message {
        string id PK "Assigned by Firestore"
        string type "image/text"
        string category "Not used for now"
        string text "Text or caption"
        string hash "Image hash, for image only"
        string textHash "hash of original text, for text only"
        string strippedTextHash "hash of stripped text, for text only"
        string mediaId "Media ID from whatsApp, for image only"
        string mimeType "For image only"
        string storageURL "Cloud storage URL, for image only"
        timestamp firstTimestamp "Timestamp of first instance"
        boolean isPollStarted
        boolean isAssessed "Should message be considered assessed and ready for reply"
				timestamp assessedTimestamp
        boolean isScam
        boolean isIrrelevant "Should message be considered assessed and ready for reply"
        number truthScore
        string customReply "Not used for now"
    }

    instance {
        string id PK "Assigned by Firestore"
        string source "whatsapp/telegram"
        string id "whatsapp message id (needed to reply)"
        timestamp timestamp
        string type "text/image"
        string text "Text or caption"
        string from "Sender ID or phone number"
        string hash "Image hash, for image only"
        string mediaId "Media ID from whatsApp, for image only"
        string mimeType "For image only"
        boolean isForwarded "Not used for now"
        boolean isFrequentlyForwarded "Not used for now"
        boolean isReplied "System has replied to the citizen"
				timestamp replyTimestamp
        string matchType "either exact, stripped, similarity or none"
        string strippedText
        boolean scamShieldConsent
    }

    voteRequests {
        string id PK "Assigned by Firestore"
        reference factCheckerDocRef FK "link to factChecker"
        string platformId "whatsapp number or telegram Id"
        string platform "whatsapp/telegram"
        boolean hasAgreed "whether person has agreed to vote"
        boolean isScam "response to whether it is scam"
        string sentMessageId "message id of the forwarded dubious message to checkers"
        string vote "scam, irrelevant, or number"
    }

    factChecker {
        string id PK "using their sender ID or phone number"
        string name
        boolean isActive
        string platformId
        number level "Not used for now"
        number experience "Not used for now"
        number numVoted "Not used for now"
        number numCorrectVotes "Not used for now"
        number numVerifiedLinks "Not used for now"
        string preferredPlatform"whatsapp/telegram, only whatsapp used for now"
				string getNameMessageId "ID of the message sent to prompt factChecker for their name. Used to track reply."
    }

		user {
				string id PK "using their sender ID or phone number"
				number instanceCount
				timestamp lastSent
				timestamp onboardMessageReceiptTime "when they sent in the prepopulated onboard message, optional field that only is included if they do send in before doing anything else"
		}

    message ||--|{ instance: has
		user ||--|{ instance: sends
    message ||--o{ voteRequests: triggers
    factChecker ||--o{ voteRequests: responds_to