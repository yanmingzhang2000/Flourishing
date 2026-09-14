import json
from collections import defaultdict
PATH="/workspace/flourish_rag_exercise_library_v2.json"
ALLOWED_CONTRA={"shoulder_impingement","rotator_cuff","neck_pain","elbow_pain","wrist_pain","lower_back","sciatica","knee_pain","meniscus"}
ALLOWED_MUSCLE={"三角肌前束","三角肌中束","三角肌后束","斜方肌上束","冈上肌","肱二头肌","肱三头肌","前臂","胸大肌","背阔肌","斜方肌中下束","菱形肌","竖脊肌","腹直肌","腹横肌","腹斜肌","下背","臀大肌","臀中肌","股四头肌","腘绳肌","内收肌","小腿三头肌","多肌群协同"}
ALLOWED_EQUIP={"bodyweight","dumbbell_0.5kg","dumbbell_1kg","dumbbell_1.5kg","dumbbell_2kg","dumbbell_3kg","dumbbell_5kg","band_light","band_mid","band_heavy","rope_light","rope_mid","rope_heavy","mat_6mm","mat_8mm","mat_10mm","foam_roller_spike","foam_roller_plain","rope_skip_weighted","rope_skip_normal","kettlebell_2kg","kettlebell_4kg","kettlebell_6kg","kettlebell_8kg","door_pull","yoga_block","yoga_ball_55","yoga_ball_65","yoga_ball_75","trx"}
ALLOWED_PROJECT={"tricep_tone","hip_thigh_tone","lower_abs_tone","trap_relax","round_shoulder_fix","full_body_basic"}
REQUIRED={"exercise_id","name","name_en","muscle_group","difficulty","equipment","function","category","target_projects","contraindications","rest_seconds","steps","tips","warning","needs_review"}
data=json.load(open(PATH,encoding="utf-8"))
print(f"总动作数: {len(data)}\n")
viol={"missing_field":[],"dup_id":[],"bad_contra":[],"bad_muscle":[],"bad_equip":[],"bad_project":[],"bad_diff":[],"empty_contra":[]}
seen={}
for ex in data:
    eid=ex.get("exercise_id","<no-id>")
    if eid in seen: viol["dup_id"].append(eid)
    seen[eid]=1
    miss=[f for f in REQUIRED if f not in ex]
    if miss: viol["missing_field"].append((eid,miss))
    for c in ex.get("contraindications",[]):
        if c not in ALLOWED_CONTRA: viol["bad_contra"].append((eid,c))
    if not ex.get("contraindications"): viol["empty_contra"].append(eid)
    for m in ex.get("muscle_group",{}).get("primary",[])+ex.get("muscle_group",{}).get("secondary",[]):
        if m not in ALLOWED_MUSCLE: viol["bad_muscle"].append((eid,m))
    for eq in ex.get("equipment",[]):
        if eq not in ALLOWED_EQUIP: viol["bad_equip"].append((eid,eq))
    for p in ex.get("target_projects",[]):
        if p not in ALLOWED_PROJECT: viol["bad_project"].append((eid,p))
    d=ex.get("difficulty")
    if not isinstance(d,int) or d<1 or d>5: viol["bad_diff"].append((eid,d))
print("=== 违规检查（v2）===")
for k,v in viol.items():
    print(f"  [{k}] {len(v)} 处" + ("" if not v else f" -> {v[:5]}"))
print("\n=== 各项目覆盖（含难度 1/2/3/4/5）===")
proj_count=defaultdict(lambda:[0,0,0,0,0,0])
for ex in data:
    d=ex["difficulty"]
    for p in ex["target_projects"]:
        proj_count[p][0]+=1; proj_count[p][d]+=1
for p in ALLOWED_PROJECT:
    c=proj_count[p]
    print(f"  {p:22s} 总数={c[0]:2d}  D1->{c[1]} D2->{c[2]} D3->{c[3]} D4->{c[4]} D5->{c[5]}")
print("\n=== 是否有 function 含减脂/瘦字眼（合规检查）===")
bad_func=[ex["exercise_id"] for ex in data if any(w in ex["function"].get("primary","")+ex["function"].get("secondary","") for w in ["减脂","瘦","燃脂"])]
print("  违规:", bad_func if bad_func else "0 处 ✔")
print("\n=== full_body_basic 的 stretch 类 ===")
print("  ", [ex["exercise_id"] for ex in data if "full_body_basic" in ex["target_projects"] and ex["category"]=="stretch"])
print("\n=== needs_review 标记 ===")
print("  ", [ex["exercise_id"] for ex in data if ex.get("needs_review")])
