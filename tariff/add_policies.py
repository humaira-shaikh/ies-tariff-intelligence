import json
from datetime import datetime, timezone

NOW = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
CTX = 'https://raw.githubusercontent.com/beckn/DEG/ies-specs/specification/external/schema/ies/core/context.jsonld'

new_policies = [
  {
    'id':'policy-brpl-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-delhi-dom-fy202526',
    'policyID':'BRPL-DOM','policyName':'BSES Rajdhani Power Ltd - Domestic FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':200,'price':3.00,'@type':'EnergySlab'},
      {'id':'s2','start':201,'end':400,'price':4.50,'@type':'EnergySlab'},
      {'id':'s3','start':401,'end':None,'price':6.50,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[
      {'id':'peak-surcharge','@type':'SurchargeTariff','recurrence':'P1D',
       'interval':{'start':'T17:00:00Z','duration':'PT5H'},'value':1.00,'unit':'INR_PER_KWH'}
    ]
  },
  {
    'id':'policy-bypl-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-delhi-dom-fy202526',
    'policyID':'BYPL-DOM','policyName':'BSES Yamuna Power Ltd - Domestic FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':200,'price':3.00,'@type':'EnergySlab'},
      {'id':'s2','start':201,'end':400,'price':4.75,'@type':'EnergySlab'},
      {'id':'s3','start':401,'end':None,'price':6.75,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[
      {'id':'peak-surcharge','@type':'SurchargeTariff','recurrence':'P1D',
       'interval':{'start':'T17:00:00Z','duration':'PT5H'},'value':1.00,'unit':'INR_PER_KWH'}
    ]
  },
  {
    'id':'policy-bescom-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-karnataka-dom-fy202526',
    'policyID':'BESCOM-DOM','policyName':'BESCOM Domestic Supply FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':30,'price':0.0,'@type':'EnergySlab'},
      {'id':'s2','start':31,'end':100,'price':4.15,'@type':'EnergySlab'},
      {'id':'s3','start':101,'end':200,'price':5.85,'@type':'EnergySlab'},
      {'id':'s4','start':201,'end':None,'price':7.45,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[
      {'id':'fuel-surcharge','@type':'SurchargeTariff','recurrence':'P1M',
       'interval':{'start':'T00:00:00Z','duration':'PT24H'},'value':0.25,'unit':'INR_PER_KWH'},
      {'id':'night-rebate','@type':'SurchargeTariff','recurrence':'P1D',
       'interval':{'start':'T22:00:00Z','duration':'PT8H'},'value':-5,'unit':'PERCENT'}
    ]
  },
  {
    'id':'policy-msedcl-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-maharashtra-dom-fy202526',
    'policyID':'MSEDCL-DOM','policyName':'MSEDCL Domestic Supply FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':100,'price':2.83,'@type':'EnergySlab'},
      {'id':'s2','start':101,'end':300,'price':5.45,'@type':'EnergySlab'},
      {'id':'s3','start':301,'end':500,'price':7.29,'@type':'EnergySlab'},
      {'id':'s4','start':501,'end':None,'price':9.06,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[
      {'id':'wheeling-charge','@type':'SurchargeTariff','recurrence':'P1M',
       'interval':{'start':'T00:00:00Z','duration':'PT24H'},'value':0.40,'unit':'INR_PER_KWH'},
      {'id':'peak-surcharge','@type':'SurchargeTariff','recurrence':'P1D',
       'interval':{'start':'T18:00:00Z','duration':'PT4H'},'value':1.50,'unit':'INR_PER_KWH'}
    ]
  },
  {
    'id':'policy-tpddl-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-delhi-dom-fy202526',
    'policyID':'TPDDL-DOM','policyName':'Tata Power Delhi Distribution Ltd - Domestic FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':200,'price':3.00,'@type':'EnergySlab'},
      {'id':'s2','start':201,'end':400,'price':4.50,'@type':'EnergySlab'},
      {'id':'s3','start':401,'end':None,'price':6.50,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[
      {'id':'tod-peak','@type':'SurchargeTariff','recurrence':'P1D',
       'interval':{'start':'T18:00:00Z','duration':'PT4H'},'value':1.50,'unit':'INR_PER_KWH'},
      {'id':'tod-offpeak','@type':'SurchargeTariff','recurrence':'P1D',
       'interval':{'start':'T22:00:00Z','duration':'PT8H'},'value':-0.50,'unit':'INR_PER_KWH'}
    ]
  },
  {
    'id':'policy-ndmc-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-delhi-dom-fy202526',
    'policyID':'NDMC-DOM','policyName':'NDMC - New Delhi Municipal Council Domestic FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':200,'price':2.00,'@type':'EnergySlab'},
      {'id':'s2','start':201,'end':400,'price':3.00,'@type':'EnergySlab'},
      {'id':'s3','start':401,'end':None,'price':5.00,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[]
  },
  {
    'id':'policy-dhbvn-dom-fy2526','@context':CTX,'objectType':'POLICY','@type':'POLICY',
    'createdDateTime':NOW,'modificationDateTime':NOW,'programID':'prog-haryana-dom-fy202526',
    'policyID':'DHBVN-DOM','policyName':'DHBVN Haryana Domestic Supply FY2025-26',
    'policyType':'TARIFF','samplingInterval':'R/2025-04-01T00:00:00Z/P1M',
    'energySlabs':[
      {'id':'s1','start':0,'end':50,'price':2.00,'@type':'EnergySlab'},
      {'id':'s2','start':51,'end':100,'price':3.75,'@type':'EnergySlab'},
      {'id':'s3','start':101,'end':250,'price':5.25,'@type':'EnergySlab'},
      {'id':'s4','start':251,'end':500,'price':6.25,'@type':'EnergySlab'},
      {'id':'s5','start':501,'end':None,'price':7.10,'@type':'EnergySlab'}
    ],
    'surchargeTariffs':[
      {'id':'fuel-surcharge','@type':'SurchargeTariff','recurrence':'P1M',
       'interval':{'start':'T00:00:00Z','duration':'PT24H'},'value':0.20,'unit':'INR_PER_KWH'}
    ]
  },
]

with open('policies.jsonld') as f:
    existing = json.load(f)

existing_ids = {p['policyID'] for p in existing}
added = []
for p in new_policies:
    if p['policyID'] not in existing_ids:
        existing.append(p)
        added.append(p['policyID'])

with open('policies.jsonld','w') as f:
    json.dump(existing, f, indent=2)

print(f'Added {len(added)} policies: {added}')
print(f'Total now: {len(existing)}')
