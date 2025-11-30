import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  FileCode, 
  ExternalLink, 
  Github, 
  Bug,
  ChevronRight,
  Lock,
  Search,
  Check
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import generatedBg from "@assets/generated_images/dark_purple_abstract_gradient.png";

export default function SecurityPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full text-foreground overflow-hidden relative" data-testid="page-security">
      <div className="fixed inset-0 z-0 opacity-10 dark:opacity-20 pointer-events-none">
        <img 
          src={generatedBg} 
          alt="" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/90 dark:bg-background/80 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-5xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 space-y-6"
        >
          <Badge variant="outline" className="border-green-600 dark:border-green-500/50 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/10 px-4 py-1 text-sm uppercase tracking-wider mb-4" data-testid="badge-remediated">
            <CheckCircle2 className="w-4 h-4 mr-2 inline-block" />
            100% Remediated
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground mb-4">
            Security First. <span className="text-primary">Always.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            All 12 audit findings identified and resolved. Full transparency on fixes, trade-offs, and verification.
          </p>

          <div className="mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-0 relative">
              <div className="hidden md:block absolute top-1/2 left-10 right-10 h-0.5 bg-border -z-10 -translate-y-1/2" />
              
              <TimelineStep status="completed" label="Audit Completed" date="Q4 2025" />
              <TimelineStep status="completed" label="Fixes Implemented" date="100% Done" />
              <TimelineStep status="completed" label="Hardhat Tests" date="56 Passing" />
              <TimelineStep status="active" label="Ready for Mainnet" date="Live Now" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <Card className="bg-card backdrop-blur-xl border-border overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Auditor</p>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    <span className="font-bold text-xl text-foreground">Asfalia Security</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Scope</p>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm text-foreground">StakingBoost.sol</span>
                    <span className="font-mono text-sm text-muted-foreground">ShieldToken.sol</span>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 bg-secondary/50 dark:bg-secondary/30 rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-center text-center gap-2">
                    <SeverityStat count={0} label="Critical" color="text-red-600 dark:text-red-500" />
                    <div className="w-px h-8 bg-border" />
                    <SeverityStat count={1} label="High" color="text-orange-600 dark:text-orange-500" />
                    <div className="w-px h-8 bg-border" />
                    <SeverityStat count={4} label="Low" color="text-yellow-600 dark:text-yellow-500" />
                    <div className="w-px h-8 bg-border" />
                    <SeverityStat count={7} label="Info" color="text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h2 className="text-2xl font-bold text-foreground">Findings & Remediations</h2>
              <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                Report v1.0
              </Badge>
            </div>

            <Accordion type="single" collapsible defaultValue="item-1" className="space-y-4">
              <FindingItem 
                id="item-1"
                code="SB-01"
                severity="High"
                severityColor="bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/20"
                title="Centralized FXRP Reward Control"
                description="Owner could potentially recover FXRP owed to stakers."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <span className="text-muted-foreground font-mono text-xs uppercase">Remediation</span>
                    <p className="text-green-700 dark:text-green-400 flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" />
                      Added getRecoverableFxrp() to calculate safe recovery amount, protecting staker rewards.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-muted-foreground font-mono text-xs uppercase">Verification</span>
                    <p className="text-muted-foreground">37 Hardhat tests verify owner cannot drain staker rewards.</p>
                  </div>
                </div>
              </FindingItem>

              <FindingItem 
                id="item-2"
                code="SB-03"
                severity="Informational"
                severityColor="bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/20"
                title="Lock Period Logic Flaw"
                description="Potential for lock gaming if stakedAt timestamp isn't updated on each deposit."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <span className="text-muted-foreground font-mono text-xs uppercase">Remediation</span>
                    <p className="text-green-700 dark:text-green-400 flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" />
                      Reset stakedAt on each new deposit to prevent gaming attacks.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-muted-foreground font-mono text-xs uppercase">Trade-off</span>
                    <p className="text-muted-foreground">Slightly higher gas cost for stronger security guarantees.</p>
                  </div>
                </div>
              </FindingItem>

              <FindingItem 
                id="item-3"
                code="ST-02"
                severity="Informational"
                severityColor="bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/20"
                title="Unused Ownable Inheritance"
                description="Contract inherited Ownable but never used onlyOwner modifiers."
              >
                <div className="space-y-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs uppercase">Remediation</span>
                  <p className="text-green-700 dark:text-green-400 flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Removed Ownable inheritance. ShieldToken is now fully permissionless with no admin functions.
                  </p>
                </div>
              </FindingItem>

              <FindingItem 
                id="item-4"
                code="SB-04"
                severity="Medium"
                severityColor="bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/20"
                title="Fee-on-Transfer Token Assumption"
                description="Contract assumed tokens transfer full amount without fees."
              >
                <div className="space-y-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs uppercase">Remediation</span>
                  <p className="text-green-700 dark:text-green-400 flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Added balance checks before/after transfers to detect and reject fee-on-transfer tokens.
                  </p>
                </div>
              </FindingItem>

              <FindingItem 
                id="item-5"
                code="ST-01"
                severity="Informational"
                severityColor="bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/20"
                title="Centralized Token Distribution"
                description="Initial supply minted to deployer address."
              >
                <div className="p-3 bg-secondary/50 rounded border border-border text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    Intentional fair-launch design. All 10M tokens minted to deployer for distribution via liquidity pools, airdrops, and staking rewards. Documented in whitepaper.
                  </p>
                </div>
              </FindingItem>
              
              <div className="p-4 bg-card rounded-lg border-dashed border border-border flex items-center justify-center text-muted-foreground text-sm flex-wrap gap-2">
                <span>7 additional findings resolved</span>
                <a href="/attached_assets/Shield Finance Audit Remediation Verification_1764500884263.pdf" target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" className="text-primary h-auto p-0" data-testid="button-view-report">
                    View Full Report <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              </div>
            </Accordion>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              <Card className="bg-card border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                    <FileCode className="w-5 h-5 text-primary" />
                    Test Coverage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-foreground">56</span>
                    <span className="text-sm text-muted-foreground mb-1">Tests Passing</span>
                  </div>
                  
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div className="bg-green-500 h-full w-full" />
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Verified Scenarios</p>
                    <ul className="space-y-2">
                      <TestItem id="SB-01" label="Owner cannot drain rewards" />
                      <TestItem id="SB-02" label="Reentrancy protection" />
                      <TestItem id="SB-03" label="Lock period reset logic" />
                      <TestItem id="SB-04" label="Fee-on-transfer detection" />
                      <TestItem id="SB-05" label="Orphaned rewards handling" />
                      <TestItem id="SB-06" label="forceApprove pattern" />
                      <TestItem id="SB-07" label="Zero-address validation" />
                      <TestItem id="ST-02" label="Permissionless token" />
                    </ul>
                  </div>
                  
                  <a href="https://github.com/Shield-Finance/contracts" target="_blank" rel="noopener noreferrer">
                    <Button className="w-full" variant="outline" data-testid="button-github">
                      <Github className="w-4 h-4 mr-2" />
                      View Tests on GitHub
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-24"
        >
          <LinkCard 
            icon={<Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            title="Verified on Explorer"
            description="Check contract source code verification on Flare Coston2."
            action="View Contracts"
            href="https://coston2-explorer.flare.network/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4"
          />
          <LinkCard 
            icon={<Lock className="w-6 h-6 text-primary" />}
            title="Full Audit Report"
            description="Download the complete PDF report with technical details."
            action="Download PDF"
            href="/attached_assets/Shield Finance Audit Remediation Verification_1764500884263.pdf"
          />
          <LinkCard 
            icon={<Bug className="w-6 h-6 text-green-600 dark:text-green-400" />}
            title="Bug Bounty"
            description="Report vulnerabilities responsibly for rewards."
            action="Learn More"
            href="#"
          />
        </motion.div>

        <footer className="text-center border-t border-border pt-12 pb-8">
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            <AlertTriangle className="w-4 h-4 inline mr-2 text-yellow-600 dark:text-yellow-500/50" />
            Audits reduce risk but never eliminate it entirely. Always do your own research (DYOR) before depositing funds into any DeFi protocol.
          </p>
        </footer>
      </div>
    </div>
  );
}

function TimelineStep({ status, label, date }: { status: "completed" | "active" | "pending", label: string, date: string }) {
  const isCompleted = status === "completed";
  const isActive = status === "active";
  
  return (
    <div className="flex flex-col items-center relative z-10 md:w-1/4 mb-8 md:mb-0 group">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center border-2 mb-3 transition-all duration-300
        ${isCompleted ? "bg-green-100 dark:bg-green-900/20 border-green-500 text-green-600 dark:text-green-500" : 
          isActive ? "bg-primary/10 dark:bg-primary/20 border-primary text-primary scale-110" : 
          "bg-secondary border-border text-muted-foreground"}
      `}>
        {isCompleted ? <Check className="w-5 h-5" /> : isActive ? <div className="w-3 h-3 bg-current rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-current rounded-full" />}
      </div>
      <h3 className={`font-bold text-sm mb-1 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</h3>
      <span className="text-xs font-mono text-muted-foreground/70">{date}</span>
    </div>
  );
}

function SeverityStat({ count, label, color }: { count: number, label: string, color: string }) {
  return (
    <div className="flex flex-col items-center px-2 md:px-4">
      <span className={`text-2xl md:text-3xl font-bold ${color}`}>{count}</span>
      <span className="text-xs text-muted-foreground font-mono uppercase mt-1">{label}</span>
    </div>
  );
}

function FindingItem({ id, code, severity, severityColor, title, description, children }: {
  id: string;
  code: string;
  severity: string;
  severityColor: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={id} className="border border-border bg-card rounded-lg px-4 mb-2 overflow-hidden data-[state=open]:bg-card transition-colors">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-start md:items-center gap-4 text-left w-full pr-4 flex-wrap">
          <Badge variant="outline" className={`${severityColor} shrink-0 font-mono`}>
            {code} - {severity}
          </Badge>
          <div className="flex-1">
            <h4 className="font-medium text-foreground">{title}</h4>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pl-1 pt-0">
        <div className="ml-0 md:ml-[calc(100px+1rem)] space-y-4 border-l border-border pl-4 mt-2">
          <p className="text-muted-foreground">{description}</p>
          {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function TestItem({ id, label }: { id: string, label: string }) {
  return (
    <li className="flex items-center gap-3 text-sm text-muted-foreground">
      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500/50 shrink-0" />
      <span className="font-mono text-xs text-muted-foreground/50 mr-1">{id}</span>
      <span>{label}</span>
    </li>
  );
}

function LinkCard({ icon, title, description, action, href }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  href: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group block p-6 rounded-xl bg-card border border-border hover:bg-secondary/50 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1" data-testid={`link-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-4 p-3 bg-secondary w-fit rounded-lg border border-border group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted-foreground text-sm mb-4">{description}</p>
      <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-foreground">
        {action} <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
      </div>
    </a>
  );
}
