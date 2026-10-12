"""Read public NWC season HTML files; emit team-season and player-season reference bands only.
Usage: python3 scripts/prepare-nwc-team-history.py output.json 2016=path.html 2017=path.html ...
Only aggregate bands are written. No athlete names or row-level statistics are retained in the output.
"""
import json, sys
from html.parser import HTMLParser
from datetime import date

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.table=None; self.row=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=='table': self.table=[]
        if tag=='tr' and self.table is not None: self.row=[]
        if tag in ('td','th') and self.row is not None: self.cell=''
    def handle_data(self, data):
        if self.cell is not None: self.cell+=data
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(self.cell.split())); self.cell=None
        if tag=='tr' and self.row is not None: self.table.append(self.row); self.row=None
        if tag=='table' and self.table is not None: self.tables.append(self.table); self.table=None

def quantile(values, p):
    v=sorted(values); x=(len(v)-1)*p; i=int(x)
    return v[i]+(v[min(i+1,len(v)-1)]-v[i])*(x-i)
def band(values, direction='higher'):
    assert len(values)>=5
    return {'cuts':[round(quantile(values,p),6) for p in (.2,.4,.6,.8)], 'mean':round(sum(values)/len(values),6), 'n':len(values), 'direction':direction}
def number(r, key): return float(r[key].split('-')[0])
def outs(ip):
    whole,_,part=str(ip).partition('.')
    assert part in ('','0','1','2')
    return int(whole)*3+int(part or 0)
def batting(rows):
    values={k:[] for k in ['batting_avg','batting_obp','batting_ops','batting_est_slg','batting_est_iso','batting_est_wobacon','batting_bb_pct','batting_k_pct','batting_hr_pct','batting_sb_per_pa']}
    for r in rows:
        ab,h,d,t,hr,bb,hbp,k,sf,sh=[number(r,key) for key in ['AB','H','2B','3B','HR','BB','HBP','SO','SF','SH']]
        assert 0<=d+t+hr<=h<=ab and h+k<=ab and ab>0
        assert number(r,'TB')==h+d+2*t+3*hr
        pa=ab+bb+hbp+sf+sh; contact=ab-k+sf; tb=h+d+t+3*hr
        results=[h/ab,(h+bb+hbp)/(ab+bb+hbp+sf),(h+bb+hbp)/(ab+bb+hbp+sf)+tb/ab,tb/ab,(d+t+3*hr)/ab,(.882*(h-d-t-hr)+1.252*(d+t)+2.037*hr)/contact,100*bb/pa,100*k/pa,100*hr/pa,number(r,'SB-ATT')/pa]
        for key,value in zip(values,results): values[key].append(value)
    return {key:band(v,'lower' if key=='batting_k_pct' else 'higher') for key,v in values.items()}
def pitching(rows):
    values={k:[] for k in ['pitching_k9','pitching_bb9','pitching_r9','pitching_whip','pitching_k_bb']}
    for r in rows:
        o=outs(r['IP']); assert o>0
        h,bb,k,runs=[number(r,key) for key in ['H','BB','SO','R']]
        for key,v in zip(list(values)[:4],[27*k/o,27*bb/o,27*runs/o,3*(h+bb)/o]): values[key].append(v)
        if bb>0: values['pitching_k_bb'].append(k/bb)
    return {key:band(v,'higher' if key in ['pitching_k9','pitching_k_bb'] else 'lower') for key,v in values.items()}

def team_rows(path):
    p=Tables(); p.feed(open(path, encoding='utf-8', errors='ignore').read())
    def records(i):
        table=p.tables[i]; assert all(len(r)==len(table[0]) for r in table)
        return [dict(zip(table[0],r)) for r in table[1:]]
    bat, pit = records(0), records(1)
    assert len(bat)==len(pit)>=8
    hitters=[r for r in records(3) if number(r,'AB')>=75]
    pitchers=[r for r in records(4) if outs(r['IP'])>=60]
    return bat, pit, hitters, pitchers
seasons={}
for arg in sys.argv[2:]:
    year, path = arg.split('=',1)
    seasons[int(year)] = team_rows(path)
all_bat=[r for y in sorted(seasons) for r in seasons[y][0]]
all_pit=[r for y in sorted(seasons) for r in seasons[y][1]]
all_hitters=[r for y in sorted(seasons) for r in seasons[y][2]]
all_pitchers=[r for y in sorted(seasons) for r in seasons[y][3]]
years=sorted(seasons)
result={'source':'https://nwcsports.com/stats.aspx?path=baseball','seasons':years,'retrievedOn':str(date.today()),
  'method':'Linear-interpolated 20th, 40th, 60th and 80th percentiles across every NWC team-season or qualified player-season. Coaching labels are dashboard bands, not official NWC grades.',
  'excluded':{'2020':'COVID-shortened season (4-16 games per team)'},
  'team':{**batting(all_bat),**pitching(all_pit)},
  'player':{**batting(all_hitters),**pitching(all_pitchers)},
  'cohorts':{'teamSeasons':len(all_bat),'perSeason':{str(y):len(seasons[y][0]) for y in years},
    'hitterSeasons':len(all_hitters),'minimumAB':75,'pitcherSeasons':len(all_pitchers),'minimumIP':20}}
with open(sys.argv[1],'w') as f: json.dump(result,f,indent=2); f.write('\n')
print('Verified cohorts:',result['cohorts'])
