module.exports = {
    analyzePrompt: (source, text) => ({
        role: 'user',
        role: 'user',
        content: `You are analyzing text for credibility and manipulation. Maintain high precision - only flag genuine issues that would mislead readers.

DEFINITIONS:
- Misinformation: False information spread without malicious intent
- Disinformation: Deliberately created and spread to deceive
- Malinformation: True information shared maliciously to cause harm
- Manipulation: Techniques used to influence thinking or behavior deceptively

Source: "${source}"
Text to analyze: "${text}"

CREDIBILITY SCORING CALIBRATION:
0-2: Deliberately deceptive, multiple high-severity issues
3-4: Major credibility issues, but not necessarily deliberate
5-6: Mixed credibility, some issues but some reliable elements
7-8: Generally reliable with minor issues
9-10: Highly reliable, follows journalistic/academic standards

ANALYZE FOR THESE MANIPULATION TECHNIQUES:
1. Emotional Manipulation
   - Fear-mongering ("They don't want you to know...")
   - Outrage bait (excessive punctuation, ALL CAPS)
   - Appeal to anger or tribal identity
   - Urgency pushing ("Act now!", "Before it's too late")
2. Information Manipulation
   - Cherry-picked data or quotes
   - Missing crucial context
   - False equivalences
   - Correlation presented as causation
   - Buried corrections or updates
3. Argumentative Manipulation
   - Straw man arguments
   - False dichotomies
   - Moving goalposts
   - Gish gallop (overwhelming with claims)
   - Slippery slope arguments
4. Authority Manipulation
   - False experts
   - Misrepresented credentials
   - Anonymous "sources say"
   - Circular references
5. Narrative Manipulation
   - Conspiracy frameworks
   - Hidden truth claims
   - "Us vs them" framing
   - "Connect the dots" implications

COMMON PATTERNS TO EVALUATE:
- Language Patterns: Excessive urgency, absolutist terms ("never", "always")
- Structure Patterns: Buried corrections, misleading headlines vs content
- Source Patterns: Circular references, unverifiable sources
- Narrative Patterns: Victim narratives, slippery slope arguments
- Writing Patterns: Excessive jargon to obscure meaning, emotional language in factual reporting

SEVERITY GUIDELINES:
- Low: Issues that may affect tone but not core message
  Examples: Mild exaggeration, incomplete context, casual speculation
- Medium: Issues that affect interpretation but facts remain mostly accurate
  Examples: Significant omissions, loaded language, unsubstantiated claims
- High: Issues that fundamentally alter understanding or intentionally deceive
  Examples: False statements, manufactured quotes, deliberate misrepresentation

DO NOT FLAG (with reasoning):
- Satire/Parody: If clearly labeled or context makes it obvious
  * Well-known satire sources include The Onion, Babylon Bee, The Borowitz Report
  * Watch for clearly impossible scenarios (e.g., conversations with inanimate objects, divine beings doing mundane tasks)
  * Context often makes satirical intent obvious through absurdist elements or clearly humorous framing
- Opinion Pieces: If transparently presented as opinion
- Strong Criticism: If backed by specific examples and evidence
- Technical Content: If jargon serves a legitimate expert audience
- Advocacy: If the position and motivation are transparent
- Historical Quotes: If presented with proper context
- Cultural References: If appropriate for the intended audience

SOURCE CREDIBILITY FACTORS:
- Known Publishers: Higher baseline credibility, focus on content
- Social Media: Evaluate claims and evidence more strictly
- Academic (.edu): Evaluate within academic context
- Government (.gov): Consider official capacity
- Personal Sites: Higher scrutiny of extraordinary claims

ADDITIONAL CREDIBILITY INDICATORS:
- Transparent authorship
- Clear distinction between fact and opinion
- Presence of editorial standards
- Update and correction practices
- Citations and verifiable sources
- Balance in presenting conflicting viewpoints
- Appropriate expertise for technical topics

RECOMMENDATION GUIDELINES:
Try and keep recommendations concise and focused. For high-credibility content (7-10), limit to 2-3 sentences highlighting key trust factors. For lower-credibility content, focus on specific issues found and actionable guidance for readers.

Provide analysis in this JSON format:
{
    "potential_issues": [
        {
            "type": "type of manipulation",
            "explanation": "detailed explanation with specific examples from text",
            "severity": "low/medium/high"
        }
    ],
    "credibility_score": <number 0-10>,
    "key_concerns": ["list of major concerns"],
    "recommendation": "specific guidance for reader",
    "trust_factors": ["positive elements that increase credibility"]
}

For legitimate content without significant issues, respond with:
{
    "potential_issues": [],
    "credibility_score": <appropriate score>,
    "key_concerns": [],
    "recommendation": "Clear explanation of why content appears reliable",
    "trust_factors": ["list of positive credibility indicators"]
}

Base analysis ONLY on provided content. Do not invent issues. If uncertain, favor assuming legitimacy over flagging potential issues. Always explain your reasoning in the recommendation field.`
    })
};