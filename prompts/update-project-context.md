# Update Project Context

Project: PictureGPS-to-MapOnline
Type: web-app
Documents available: prd.md, design.md, architecture.md, rules.md, tasks.md, memory.md
Primary goal: เป็นโปรแกรมที่ทำงาน จะทำโดยการ upload ภาพที่มี GPS โปรแกรมจะอ่าน meta data ของรูปภาพและมีการแสดงพิกัดบน map และบอกค่าต่างในรูปภาพ เท่าที่สามารถทำได้ถ้ามีการ upload หลายๆ ภาพ จะทำการเช็คเวลาที่ถ่ายและทำเป็นเส้น Routing ให้และมีบอก label ว่ารูปไหนเกิดก่อน ให้ใส่เลข 1 รูปที่ถ่ายเวลาถัดไปก็เป็นเลข 2 และสร้าง เส้น Routing บน MAP 
Prompt pack level: advanced
Respond in Thai unless code or technical identifiers should remain in English.

After implementation, update the project context documents so the exported blueprint stays current.

Update these files when they are affected:
- tasks.md: mark completed work, add new follow-up tasks, and reorder priorities if implementation changed the execution plan
- memory.md: capture durable decisions, blockers, assumptions, and important discoveries for the next working session
- architecture.md: update stack, module boundaries, API shape, data flow, auth flow, or technical decisions if implementation changed them
- prd.md: update scope, feature intent, user flow, or success criteria only when the product direction truly changed

Rules:
- Do not rewrite documents that were not affected
- Keep updates concise and source-of-truth oriented
- Call out assumptions before editing if the change is ambiguous
- End with a short handoff summary of what changed, what remains, and which documents were updated