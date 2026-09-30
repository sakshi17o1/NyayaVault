const { redact } = require('./src/lib/redact'); 
const text = `FIRST INFORMATION REPORT
2)
लि oTAtT
(Under Section 154 Cr.P.C.) SoLICE we
g1cTIo x”
* नि
FIR No: FIR-FN-2026-4418 Date:\1l2-May-2026
Police Station: Fictional Nagar District: Example City
Case No: WS-2026-0001
1. Name of Complainant: Anita Sharma
2. Details of Incident:
The complainant states that on 12-May-2026 at approximately 3:30 PM, she was walking
near the main entrance of Riverbank Market, Fictional Nagar. An unknown male
individual aggressively followed her, shouting derogatory comments and making
unwanted advances. The suspect cornered her near a stall and grabbed her arm, causing
her to cry out. Bystanders intervened, forcing the suspect to flee towards the
parking lot.
3. Suspect Details: Unknown male, approx 5'10", wearing a blue jacket.
4. Sections of Law: Section 354, 354D, 509 IPC.
Signature of Investigating Officer
IO Kavya Mehra
Sub-Inspector`; 
const extracted = { fields: { caseNumber: 'FIR-FN-2026-4418', policeStation: 'Fictional Nagar District: Example City', date: '2-May-2026' } }; 
const keys = ['caseNumber', 'policeStation', 'date']; 
console.log(redact(text, extracted, keys));
