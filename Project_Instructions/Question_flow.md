When three different diseases share the exact same starting symptoms, standard chatbots fail because they randomly guess one. To build a robust clinical engine, you must implement **Active Disambiguation** — a process where the AI intentionally asks questions designed to eliminate the deadliest possibilities first.

Here is the complete architectural flow for resolving overlapping symptoms, followed by the specific scenarios and questions your AI must use.

---

## The Disambiguation Flow

When the AI detects symptoms that match multiple pathways, it must execute this 4-step logic loop:

**Step 1: The Wide Net (Semantic Match)**
The LLM identifies that the user's raw transcript (e.g., *"My chest feels tight and I'm dizzy"*) matches the `primary_triggers` of three different pathways (e.g., Heart Attack, Panic Attack, GERD/Heartburn).

**Step 2: Risk Stratification (Safety First)**
The AI temporarily hides the lower-severity pathways (Panic Attack, GERD) and locks onto the highest `severity_rank` pathway (Heart Attack, `emergency`).

**Step 3: The "Rule-Out" Cross-Examination**
The AI looks at the `secondary_symptoms_to_check` for the deadliest condition and asks a highly specific question to either confirm or deny it. It completely ignores the minor conditions until the deadly one is ruled out.

**Step 4: Resolution or Downgrade**

* **If the user says YES to the cross-examination:** The AI immediately returns `action_type: emergency_escalation`.
* **If the user says NO:** The AI discards the deadly pathway, downgrades to the next highest severity, and evaluates those.

---

## 3 Real-World Overlap Scenarios & Questions

To make this work, the AI needs to know exactly what question separates a harmless symptom from a medical emergency.

### Scenario 1: The "Chest Tightness" Overlap

A user says: *"My chest feels tight, my heart is beating fast, and I feel slightly nauseous."*

* **Potential Matches:** Acute Myocardial Infarction (Heart Attack) vs. Panic Attack vs. Acid Reflux (GERD).
* **The AI's Internal Logic:** Heart Attack is the deadliest. I must rule it out before I assume this is a panic attack.
* **The Disambiguation Questions:**
* *Question 1 (Cardiac check):* "I hear that your chest is tight. Is the pain radiating into your left arm, neck, or jaw, or do you feel like there's a heavy weight on your chest?"
* *Question 2 (GI check - if Q1 is negative):* "Since it's not radiating, does the burning sensation get worse when you lie down flat, or did it start right after eating?"


* **Routing:** If Q1 is Yes → Emergency. If Q1 is No and Q2 is Yes → GERD (Preventive). If Q1 is No and Q2 is No → Panic Attack (Preventive).

### Scenario 2: The "Dizzy & Unsteady" Overlap

A user says: *"The room is spinning, I feel lightheaded, and I can't walk straight."*

* **Potential Matches:** Stroke (TIA) vs. Vertigo (BPPV) vs. Severe Dehydration.
* **The AI's Internal Logic:** Stroke is the deadliest. I must check for neurological deficits first.
* **The Disambiguation Questions:**
* *Question 1 (Neurological check):* "I want to check something quickly—can you smile for me and tell me if one side of your face feels numb or drooping? Is your speech slurred at all?"
* *Question 2 (Vestibular/Fluid check - if Q1 is negative):* "Okay, that's good. Does the room only spin when you physically turn your head or roll over in bed, or have you just not drank much water today?"


* **Routing:** If Q1 is Yes → Emergency. If Q1 is No and Q2 is "when I turn my head" → Vertigo (Preventive). If Q1 is No and Q2 is "haven't drank water" → Dehydration (Preventive).

### Scenario 3: The "Shortness of Breath" Overlap

A user says: *"I'm having trouble catching my breath and I keep coughing."*

* **Potential Matches:** Anaphylaxis (Severe Allergy) vs. Asthma Attack vs. Viral Upper Respiratory.
* **The AI's Internal Logic:** Anaphylaxis closes the airway in minutes. Asthma is severe. A cold is minor. Check allergies first.
* **The Disambiguation Questions:**
* *Question 1 (Anaphylaxis check):* "I notice you're having trouble breathing. Do you feel your throat closing, or are your lips or tongue swelling up right now?"
* *Question 2 (Asthma check - if Q1 is negative):* "Since there's no swelling, are you wheezing when you exhale, and if you have a rescue inhaler, is it failing to work?"
* *Question 3 (Infection check - if Q2 is negative):* "Are you coughing up any green mucus or dealing with a high fever over 101 degrees?"


* **Routing:** If Q1 is Yes → Emergency. If Q2 is Yes → Asthma (`urgent_care`). If Q3 is Yes → Viral Infection (`preventive`).

---

## How to Automate this in your Python Prompt

To force the LLM to follow this flow without you having to code endless `if/else` statements, add this strict instruction to your FastAPI system prompt:

```text
CRITICAL TRIAGE DIRECTIVE - THE DIFFERENTIAL PROTOCOL:
When the user's transcript matches the primary triggers of multiple conditions in the triage_dataset, you MUST follow this strict hierarchy:
1. Identify all matched conditions.
2. Isolate the condition with the highest severity_rank (typically target_mode: "emergency").
3. DO NOT output a diagnosis. You must output action_type: "ask_follow_up".
4. The ai_spoken_response MUST be a direct question checking for the exact symptoms listed in the "secondary_symptoms_to_check" array for that highest-severity condition.
5. Only if the user explicitly denies those secondary symptoms on the next turn are you allowed to evaluate the lower-severity (preventive) conditions.

```

By enforcing this structure, you mathematically guarantee that your AI acts like a highly trained triage nurse—always checking for the worst-case scenario before offering comfort. Digital triage platforms in modern hospitals process combinations of overlapping symptoms specifically to flag high-risk cases that might initially appear mild.

Explore more about how AI supports rapid clinical decision-making in high-pressure environments through [Digital Triage in the Modern Emergency Department](https://www.youtube.com/watch?v=bbgr5WcwN7U). This discussion breaks down how real-world intelligent systems prioritize care and prevent delayed interventions for overlapping symptoms.