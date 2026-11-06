"""Reproduce the discrete reference grid used by CopulaTailComparison.

Run with an isolated pinned dependency, without changing project dependencies:
    uv run --with scipy==1.18.1 python scripts/compute-copula-tail-reference.py --output /tmp/copula-reference.json

The JSON contains probabilities and diagnostics. QUADPACK's reported errors are
estimates, not certified bounds. Compare its rows with the component's embedded
REFERENCE array when deliberately regenerating that teaching fixture.
"""
import json, math, warnings
from pathlib import Path
import scipy
from scipy.stats import norm,t
from scipy.integrate import quad,IntegrationWarning
import argparse
parser=argparse.ArgumentParser(description='Compute the discrete CopulaTailComparison reference grid and integration diagnostics.')
parser.add_argument('--output',type=Path,help='Write JSON to this path; otherwise print JSON to stdout.')
args=parser.parse_args()
rows=[];max_difference=0;max_estimate=0
for rho in [0,.25,.5,.75]:
 for nu in [3,4,10]:
  limit=2*t.cdf(-math.sqrt((nu+1)*(1-rho)/(1+rho)),df=nu+1)
  for q in [.1,.05,.01,.005,.001]:
   z=norm.ppf(q);a=t.ppf(q,df=nu);den=math.sqrt(1-rho*rho)
   gfun=lambda v:norm.cdf((z-rho*norm.ppf(q*v))/den)
   tfun=lambda v:t.cdf((a-rho*t.ppf(q*v,df=nu))*math.sqrt((nu+1)/((nu+t.ppf(q*v,df=nu)**2)*(1-rho*rho))),df=nu+1)
   g,ge=quad(gfun,0,1,epsabs=1e-11,epsrel=1e-10,limit=200)
   st,se=quad(tfun,0,1,epsabs=1e-11,epsrel=1e-10,limit=200)
   # Independent change of variable: integrate conditional density in latent x.
   gx,gxe=quad(lambda x:norm.pdf(x)*norm.cdf((z-rho*x)/den),-math.inf,z,epsabs=1e-13,epsrel=1e-10,limit=200)
   tx,txe=quad(lambda x:t.pdf(x,df=nu)*t.cdf((a-rho*x)*math.sqrt((nu+1)/((nu+x*x)*(1-rho*rho))),df=nu+1),-math.inf,a,epsabs=1e-13,epsrel=1e-10,limit=200)
   difference=max(abs(g-gx/q),abs(st-tx/q));max_difference=max(max_difference,difference);max_estimate=max(max_estimate,ge,se,gxe/q,txe/q)
   assert difference<1e-8,(rho,nu,q,difference)
   rows.append(dict(rho=rho,nu=nu,q=q,gaussian=g,student=st,limit=limit))
report=dict(scipy=scipy.__version__,rows=len(rows),maxTransformedDifference=max_difference,maxReportedQuadratureErrorEstimate=max_estimate,warning='QUADPACK estimates are diagnostic, not mathematical error guarantees. No extrapolation outside the grid.')
result={'rows':rows,'checks':report}
text=json.dumps(result,indent=2)
if args.output:
 args.output.write_text(text+'\n')
else:
 print(text)
