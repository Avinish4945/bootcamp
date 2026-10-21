(() => {
  const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;
  const { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } = ReactRouterDOM;
  const html = htm.bind(React.createElement);
  const SEED_COMPANIES = []; // Kept empty intentionally: live rendering reads Supabase only.
  function supabaseConfig() {
    const config=window.SUPABASE_CONFIG||{};
    if(!config.url||!config.anonKey)throw new Error("Supabase is not configured. Add the project URL and anon/public key to public/supabase-config.js, then redeploy.");
    return {url:config.url.endsWith("/")?config.url.slice(0,-1):config.url,key:config.anonKey};
  }
  async function supabaseSelect(table,columns,filters,orderBy) {
    const config=supabaseConfig();
    const params=["select="+encodeURIComponent(columns)];
    (filters||[]).forEach(filter=>params.push(encodeURIComponent(filter.column)+"=eq."+encodeURIComponent(String(filter.value))));
    if(orderBy)params.push("order="+encodeURIComponent(orderBy));
    let response;
    try{response=await fetch(config.url+"/rest/v1/"+table+"?"+params.join("&"),{method:"GET",headers:{apikey:config.key,Authorization:"Bearer "+config.key,Accept:"application/json"}});}
    catch(error){throw new Error("Could not reach Supabase. Check the project URL and network access. "+errorText(error));}
    const body=await response.text();let data=null;
    try{data=body?JSON.parse(body):null}catch(_){data=body;}
    if(!response.ok)throw new Error(data&&data.message?data.message:"Supabase request failed ("+response.status+"): "+String(body).slice(0,300));
    return data;
  }
  function errorText(error) { return error && error.message ? error.message : String(error || "Unknown error"); }
  function mapCompanyRow(row) { return {company_id:row.company_id,short_json:row.short_json || {},full_json:row.full_json || null}; }
  async function fetchCompanySummaries() {
    const data=await supabaseSelect("company_json","company_id,short_json",[],"company_id.asc");
    return (data||[]).map(row=>{const shortJson={...(row.short_json||{}),company_id:row.company_id};return {company_id:row.company_id,short_json:{...normalizeCompanySummary(shortJson),...shortJson},full_json:null};});
  }
  async function fetchCompanyProfile(id) {
    const rows=await supabaseSelect("company_json","company_id,short_json,full_json",[{column:"company_id",value:id}]);
    const data=(rows||[])[0]||null;
    if(!data) throw new Error("No company profile was found for this company ID.");
    return mapCompanyRow(data);
  }
  async function fetchCompanySkills(id) {
    const [levels,mastersRows,proficiencyRows,topicsRows]=await Promise.all([
      supabaseSelect("company_skill_levels","company_id,skill_set_id,required_level,required_proficiency_level_id",[{column:"company_id",value:id}]),
      supabaseSelect("skill_set_master","skill_set_id,skill_set_name,short_name",[]),
      supabaseSelect("proficiency_levels","proficiency_level_id,proficiency_name,proficiency_code",[]),
      supabaseSelect("skill_set_topics","skill_set_id,level_number,topics",[],"level_number.asc")
    ]);
    const masters=new Map((mastersRows||[]).map(x=>[String(x.skill_set_id),x]));
    const proficiencies=new Map((proficiencyRows||[]).map(x=>[String(x.proficiency_level_id),x]));
    const topicRows=new Map();
    for(const row of topicsRows||[]) {
      const key=String(row.skill_set_id);
      if(!topicRows.has(key)) topicRows.set(key,Array(10).fill(null));
      let topic=row.topics;
      if(typeof topic==="string"){try{topic=JSON.parse(topic)}catch(_){}}
      if(topic&&typeof topic==="object"&&!Array.isArray(topic)) topic=topic.topic||topic.title||topic.name||JSON.stringify(topic);
      topicRows.get(key)[Math.max(0,Number(row.level_number)-1)]=Array.isArray(topic)?topic.join(", "):String(topic||"");
    }
    const raw=(levels||[]).map(row=>{
      const master=masters.get(String(row.skill_set_id))||{};
      const proficiency=proficiencies.get(String(row.required_proficiency_level_id))||{};
      return {skill_set_id:row.skill_set_id,skill_set_name:master.skill_set_name||master.short_name||("Skill "+row.skill_set_id),short_name:master.short_name||"",required_level:Number(row.required_level)||1,required_proficiency:proficiency.proficiency_name||proficiency.proficiency_code||"",required_proficiency_level_id:row.required_proficiency_level_id,topics:(topicRows.get(String(row.skill_set_id))||Array(10).fill(null)).map((topic,i)=>topic||("Skill foundations and applied practice · Level "+(i+1)))};
    });
    return normalizeDashboardSkills(raw).sort((a,b)=>b.required_level-a.required_level);
  }
  const SECTIONS = [
    { title:"Company Identity", icon:"building-2", keys:["name","short_name","category","incorporation_year","nature_of_company"] },
    { title:"Overview & Vision", icon:"book-open", keys:["overview_text","vision_statement","mission_statement","core_values","history_timeline"] },
    { title:"Leadership", icon:"users", keys:["ceo_name","ceo_linkedin_url","key_leaders","warm_intro_pathways","decision_maker_access","board_members"] },
    { title:"Funding & Financials", icon:"chart-no-axes-combined", keys:["annual_revenue","annual_profit","revenue_mix","valuation","yoy_growth_rate","profitability_status","key_investors","recent_funding_rounds","total_capital_raised","burn_rate","runway_months","burn_multiplier"] },
    { title:"Global Presence", icon:"globe-2", keys:["headquarters_address","operating_countries","office_count","office_locations","employee_size"] },
    { title:"Products & Services", icon:"layers-3", keys:["pain_points_addressed","focus_sectors","offerings_description","top_customers","case_studies"] },
    { title:"Technology Stack", icon:"cpu", keys:["tech_stack","technology_partners","intellectual_property","r_and_d_investment","ai_ml_adoption_level","cybersecurity_posture","tech_adoption_rating"] },
    { title:"Partnerships & Ecosystem", icon:"network", keys:["partnership_ecosystem","industry_associations","event_participation"] },
    { title:"Competitive Landscape", icon:"swords", keys:["key_competitors","competitive_advantages","weaknesses_gaps","key_challenges_needs","market_share_percentage","benchmark_vs_peers","unique_differentiators"] },
    { title:"Market Opportunity", icon:"target", keys:["tam","sam","som","future_projections","strategic_priorities","sales_motion","customer_concentration_risk","exit_strategy_history","go_to_market_strategy","innovation_roadmap","product_pipeline"] },
    { title:"Core Value Proposition & ESG", icon:"leaf", keys:["core_value_proposition","esg_ratings","carbon_footprint","ethical_sourcing","sustainability_csr"] },
    { title:"Culture & Work Life", icon:"heart-handshake", keys:["work_culture_summary","manager_quality","psychological_safety","feedback_culture","diversity_inclusion_score","ethical_standards","burnout_risk","layoff_history","mission_clarity","crisis_behavior","diversity_metrics","employee_turnover","avg_retention_tenure"] },
    { title:"Recent News & Milestones", icon:"newspaper", keys:["recent_news","hiring_velocity","history_timeline"] },
    { title:"Sales & Customer Metrics", icon:"chart-no-axes-column", keys:["customer_acquisition_cost","customer_lifetime_value","cac_ltv_ratio","churn_rate","net_promoter_score","top_customers"] },
    { title:"Risk & Compliance", icon:"shield-check", keys:["regulatory_status","legal_issues","supply_chain_dependencies","geopolitical_risks","macro_risks"] },
    { title:"Work Location & Commute", icon:"map-pin", keys:["remote_policy_details","typical_hours","overtime_expectations","weekend_work","flexibility_level","location_centrality","public_transport_access","cab_policy","airport_commute_time","office_zone_type"] },
    { title:"Safety & Wellbeing", icon:"shield", keys:["area_safety","safety_policies","infrastructure_safety","emergency_preparedness","health_support"] },
    { title:"Career Growth & Learning", icon:"graduation-cap", keys:["training_spend","onboarding_quality","learning_culture","exposure_quality","mentorship_availability","internal_mobility","promotion_clarity","tools_access","role_clarity","early_ownership","work_impact","execution_thinking_balance","automation_level","cross_functional_exposure","company_maturity","brand_value","client_quality","exit_opportunities","skill_relevance","external_recognition","network_strength","global_exposure"] },
    { title:"Brand & Reputation", icon:"award", keys:["website_quality","social_media_followers","glassdoor_rating","indeed_rating","google_rating","awards_recognitions","brand_sentiment_score"] },
    { title:"Compensation & Benefits", icon:"gift", keys:["leave_policy","health_support","fixed_vs_variable_pay","bonus_predictability","esops_incentives","family_health_insurance","relocation_support","lifestyle_benefits"] },
    { title:"Digital Presence & Ratings", icon:"external-link", keys:["website_url","linkedin_url","twitter_handle","facebook_url","instagram_url","marketing_video_url","website_rating","website_traffic_rank"] },
    { title:"Contact Information", icon:"contact", keys:["primary_contact_email","primary_phone_number","contact_person_name","contact_person_title","contact_person_email","contact_person_phone","ceo_linkedin_url"] }
  ];
  const LABELS = {
    name:"Company Name",short_name:"Short Name",category:"Industry",incorporation_year:"Incorporation Year",nature_of_company:"Company Type",
    overview_text:"Overview",vision_statement:"Vision",mission_statement:"Mission",core_values:"Core Values",history_timeline:"Milestones & History",
    ceo_name:"CEO",ceo_linkedin_url:"Leadership Profile",key_leaders:"Key Leaders",warm_intro_pathways:"Introduction Pathways",decision_maker_access:"Decision-Maker Access",board_members:"Board Members",
    annual_revenue:"Annual Revenue",annual_profit:"Annual Profit",revenue_mix:"Revenue Mix",valuation:"Market Capitalization",yoy_growth_rate:"Year-over-Year Growth",profitability_status:"Profitability",key_investors:"Institutional Investors",recent_funding_rounds:"Funding Activity",total_capital_raised:"Capital Structure",burn_rate:"Cash Flow",runway_months:"Runway",burn_multiplier:"Burn Multiplier",
    headquarters_address:"Headquarters",operating_countries:"Operating Countries",office_count:"Office Count",office_locations:"Office Locations",employee_size:"Employee Size",
    pain_points_addressed:"Customer Challenges Addressed",focus_sectors:"Focus Sectors",offerings_description:"Offerings",top_customers:"Customer Segments",case_studies:"Case Studies",
    tech_stack:"Technology Stack",technology_partners:"Technology Partners",intellectual_property:"Intellectual Property",r_and_d_investment:"R&D Investment",ai_ml_adoption_level:"AI & ML Adoption",cybersecurity_posture:"Cybersecurity",tech_adoption_rating:"Technology Adoption",
    partnership_ecosystem:"Partnership Ecosystem",industry_associations:"Industry Associations",event_participation:"Industry Events",
    key_competitors:"Key Competitors",competitive_advantages:"Competitive Advantages",weaknesses_gaps:"Gaps & Weaknesses",key_challenges_needs:"Key Challenges",market_share_percentage:"Market Share Estimate",benchmark_vs_peers:"Peer Benchmark",unique_differentiators:"Differentiators",
    tam:"Total Addressable Market",sam:"Serviceable Available Market",som:"Serviceable Obtainable Market",future_projections:"Future Outlook",strategic_priorities:"Strategic Priorities",sales_motion:"Sales Motion",customer_concentration_risk:"Customer Concentration",exit_strategy_history:"Strategic Development",go_to_market_strategy:"Go-to-Market",innovation_roadmap:"Innovation Roadmap",product_pipeline:"Product Pipeline",
    core_value_proposition:"Core Value Proposition",esg_ratings:"ESG Commitments",carbon_footprint:"Environmental Impact",ethical_sourcing:"Ethical Sourcing",sustainability_csr:"Sustainability & Community",
    work_culture_summary:"Work Culture",manager_quality:"Manager Support",psychological_safety:"Psychological Safety",feedback_culture:"Feedback Culture",diversity_inclusion_score:"Inclusion",ethical_standards:"Ethical Standards",burnout_risk:"Burnout Risk",layoff_history:"Restructuring History",mission_clarity:"Mission Clarity",crisis_behavior:"Crisis Response",diversity_metrics:"Workforce Diversity",employee_turnover:"Employee Turnover Estimate",avg_retention_tenure:"Average Tenure",
    recent_news:"Recent News",hiring_velocity:"Hiring Activity",customer_acquisition_cost:"Customer Acquisition Cost",customer_lifetime_value:"Customer Lifetime Value",cac_ltv_ratio:"Acquisition / Lifetime Value",churn_rate:"Churn Estimate",net_promoter_score:"Net Promoter Score",
    regulatory_status:"Standards & Certifications",legal_issues:"Legal Context",supply_chain_dependencies:"Dependencies",geopolitical_risks:"Geopolitical Risks",macro_risks:"Macro Risks",
    remote_policy_details:"Work Model",typical_hours:"Typical Hours",overtime_expectations:"Overtime",weekend_work:"Weekend Work",flexibility_level:"Flexibility",location_centrality:"Office Location Context",public_transport_access:"Public Transport",cab_policy:"Transport Support",airport_commute_time:"Airport Commute",office_zone_type:"Office District",
    area_safety:"Area Safety",safety_policies:"Safety Policies",infrastructure_safety:"Infrastructure Safety",emergency_preparedness:"Emergency Preparedness",health_support:"Health Support",
    training_spend:"Training Investment",onboarding_quality:"Onboarding",learning_culture:"Learning Culture",exposure_quality:"Project Exposure",mentorship_availability:"Mentorship",internal_mobility:"Internal Mobility",promotion_clarity:"Promotion Process",tools_access:"Tools & Platforms",role_clarity:"Role Clarity",early_ownership:"Early Ownership",work_impact:"Work Impact",execution_thinking_balance:"Execution & Strategy",automation_level:"Automation",cross_functional_exposure:"Cross-Functional Work",company_maturity:"Company Maturity",brand_value:"Brand Value",client_quality:"Client Profile",exit_opportunities:"Career Options",skill_relevance:"Skill Relevance",external_recognition:"External Recognition",network_strength:"Professional Network",global_exposure:"Global Exposure",
    website_quality:"Website Quality",social_media_followers:"Social Followers",glassdoor_rating:"Glassdoor Rating",indeed_rating:"Indeed Rating",google_rating:"Google Rating",awards_recognitions:"Awards & Recognition",brand_sentiment_score:"Brand Sentiment",leave_policy:"Leave Policy",fixed_vs_variable_pay:"Pay Structure",bonus_predictability:"Bonus Predictability",esops_incentives:"Equity Incentives",family_health_insurance:"Family Health Insurance",relocation_support:"Relocation Support",lifestyle_benefits:"Lifestyle Benefits",
    website_url:"Website",linkedin_url:"LinkedIn",twitter_handle:"X / Twitter",facebook_url:"Facebook",instagram_url:"Instagram",marketing_video_url:"Video & Channel",website_rating:"Website Rating",website_traffic_rank:"Website Traffic Rank",primary_contact_email:"General Email",primary_phone_number:"General Phone",contact_person_name:"Contact Person",contact_person_title:"Contact Title",contact_person_email:"Contact Email",contact_person_phone:"Contact Phone"
  };
  const SECTION_ICONS = {
    "building-2":"▦","book-open":"▤","users":"♙","chart-no-axes-combined":"↗","globe-2":"◎","layers-3":"▱","cpu":"⌘","network":"◇","swords":"⚔","target":"⊙","leaf":"♧","heart-handshake":"♡","newspaper":"▤","chart-no-axes-column":"▥","shield-check":"✓","map-pin":"⌖","shield":"⬡","graduation-cap":"⌂","award":"✧","gift":"♢","external-link":"↗","contact":"▧"
  };
  const BLOOM = [
    {code:"CU",name:"Remember & understand",color:"#3b82f6",bg:"#eff6ff"},
    {code:"AP",name:"Apply",color:"#22c55e",bg:"#f0fdf4"},
    {code:"AS",name:"Analyze",color:"#eab308",bg:"#fefce8"},
    {code:"EV",name:"Evaluate",color:"#ef4444",bg:"#fef2f2"},
    {code:"CR",name:"Create",color:"#a855f7",bg:"#faf5ff"}
  ];
  const TOPICS = {
    "Data Structures & Algorithms":["Big-O notation and complexity","Arrays, strings and linked lists","Stacks, queues and hash tables","Searching and sorting patterns","Binary trees and binary search trees","Heaps, tries and balanced trees","Graphs, BFS and DFS","Greedy algorithms and dynamic programming","Advanced graph and DP problems","Timed interview sets and optimization"],
    "Object-Oriented Programming":["Classes, objects and methods","Encapsulation and access modifiers","Constructors, inheritance and polymorphism","Abstraction and interfaces","Composition and dependency design","SOLID principles and clean code","Design patterns: Factory and Strategy","Observer, Adapter and Decorator patterns","Refactoring a modular application","Model a real system with testable classes"],
    "SQL & Databases":["Tables, rows, columns and data types","SELECT, filtering and ordering","Joins, grouping and aggregate functions","Keys, constraints and normalization","Subqueries, CTEs and set operations","Indexes and query plans","Transactions and ACID properties","Window functions and optimization","Schema design for scale","Analyze and tune a realistic workload"],
    "Cloud Fundamentals (AWS/Azure)":["Cloud concepts and shared responsibility","Regions, zones and core services","Compute, storage and networking basics","IAM roles and least privilege","Deploy a static site and simple API","Managed databases and backups","Monitoring, logging and alerts","Containers and basic orchestration","Resilient multi-zone architecture","Estimate costs and design a secure deployment"],
    "Operating Systems":["Processes, programs and threads","CPU scheduling fundamentals","Concurrency and synchronization","Deadlocks and resource allocation","Virtual memory and paging","File systems and I/O","System calls and protection","Memory and process performance","Containers and OS isolation","Diagnose a concurrency or resource issue"],
    "Computer Networks":["OSI and TCP/IP models","IP addressing and subnetting","TCP, UDP and ports","DNS, HTTP and HTTPS","Routing and switching basics","TLS, certificates and secure transport","NAT, proxies and load balancing","Network troubleshooting tools","Latency, throughput and packet loss","Design and diagnose a service network"],
    "Aptitude & Logical Reasoning":["Percentages, ratios and averages","Number series and basic arithmetic","Time, speed, work and probability","Logical deductions and syllogisms","Permutations and combinations","Data interpretation charts and tables","Puzzles and constraint reasoning","Timed mixed-difficulty practice","Explain a solution under time pressure","Full-length mock assessment and review"],
    "Communication & Behavioral":["Introduce yourself clearly","Listen actively and ask clarifying questions","Structure answers with a clear beginning","Explain a project in simple terms","Practice STAR behavioral responses","Give concise technical explanations","Handle disagreement professionally","Ask thoughtful interviewer questions","Present a design and accept feedback","Mock interview, reflection and improvement"],
    "Web Development Basics":["HTML document structure and semantics","CSS selectors, box model and layout","JavaScript values, functions and arrays","DOM events and browser APIs","Async JavaScript, fetch and JSON","React components, props and state","Forms, routing and accessible UI","Connect frontend to a REST API","Build, debug and deploy a full-stack feature","Profile performance and harden accessibility"],
    "System Design (Intro)":["Client-server and request-response basics","APIs, HTTP and JSON","Application layers and state","Relational versus document data","Caching and pagination","Queues and background jobs","Load balancing and horizontal scaling","Consistency, replication and availability","Design a short-link or notification service","Explain trade-offs with a simple architecture"],
    "Git & Version Control":["Repositories, commits and working tree","Stage, commit and inspect history","Branches and merge fundamentals","Resolve merge conflicts safely","Remote repositories and pull requests","Rebase, cherry-pick and revert","Tags, releases and semantic versions","Code review and branching conventions","Recover work with reflog and bisect","Collaborate on a clean feature workflow"],
    "Generative AI Basics":["What language models can and cannot do","Tokens, context windows and prompts","Prompt structure and examples","Ground answers in trusted context","Embeddings and semantic similarity","Build a simple model API call","RAG pipelines and chunking","Evaluate quality, bias and hallucinations","Tool calling and guarded workflows","Prototype an AI feature with measurable evaluation"]
  };
  const CompanyContext = createContext(null);
  function restoreCompany() {
    try {
      const saved = JSON.parse(localStorage.getItem("selected-company") || "null");
      if (!saved || saved.companyId == null) return null;
      const short_json={short_name:saved.companyName||"Selected company",name:saved.companyName||"Selected company",logo_url:saved.logoUrl||"",category:"",company_type:"Regular"};
      return {companyId:saved.companyId,companyName:short_json.short_name,logoUrl:short_json.logo_url,company:{company_id:saved.companyId,short_json,full_json:null}};
    } catch (_) { return null; }
  }
  function CompanyProvider({children}) {
    const [selected,setSelected] = useState(restoreCompany);
    const choose = (company) => {
      const value = {companyId:company.company_id,companyName:company.short_json.short_name,logoUrl:company.short_json.logo_url};
      localStorage.setItem("selected-company",JSON.stringify(value));
      setSelected({...value,company});
    };
    return html`<${CompanyContext.Provider} value=${{selected,choose,setSelected}}>${children}<//>`;
  }
  function useCompany(){ return useContext(CompanyContext); }
  function Icon({name,size=17}) {
    const symbols = {search:"⌕",map:"⌖",users:"♙",growth:"↗",arrow:"→",menu:"☰",building:"▦",skills:"⌘",home:"⌂",external:"↗",check:"✓",spark:"✦",lock:"▣",chevron:"⌄"};
    if(name==="arrow"||name==="external"||name==="menu"||name==="search"||name==="map"||name==="users"||name==="growth"||name==="building"||name==="skills"||name==="home"||name==="check"||name==="spark"||name==="lock"||name==="chevron") return html`<span aria-hidden="true" style=${{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,fontSize:size,lineHeight:1,flexShrink:0}}>${symbols[name]}</span>`;
    return html`<span aria-hidden="true" style=${{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,fontSize:size,lineHeight:1,flexShrink:0}}>${SECTION_ICONS[name]||"◇"}</span>`;
  }
  function logoDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./,""); } catch(_){ return "accenture.com"; }
  }
  function CompanyLogo({company,className=""}) {
    const [failed,setFailed] = useState(false);
    const src = company.short_json.logo_url || "";
    const token = window.VITE_LOGO_DEV_PUBLISHABLE_KEY || "";
    const logoDevSrc = token ? "https://img.logo.dev/"+logoDomain(company.short_json.website_url||src)+"?token="+encodeURIComponent(token) : "";
    const source = !failed && logoDevSrc ? logoDevSrc : src;
    if (!source || failed && (!src || source===src)) return html`<span class=${"logo-fallback "+className} aria-label="Company logo fallback">${(company.short_json.short_name||company.short_json.name||"C").slice(0,1)}</span>`;
    return html`<img class=${"company-logo "+className} src=${source} alt=${company.short_json.short_name+" logo"} onError=${()=>setFailed(true)} />`;
  }
  function categoryStyle(category) {
    const colors = {"Super Dream":"#7c3aed","Dream":"#2563eb","Standard":"#16a34a","Regular":"#d97706"};
    return {background:colors[category]||"#64748b",color:"#fff"};
  }
  function CompanyCard({company,onSelect}) {
    const s=company.short_json;
    const negative=String(s.yoy_growth_rate||"").trim().startsWith("-");
    return html`<button class="company-card" onClick=${()=>onSelect(company)} aria-label=${"Open company intelligence for "+s.name}>
      <div class="card-head"><${CompanyLogo} company=${company}/><span class="category-badge" style=${categoryStyle(s.company_type)}>${s.company_type}</span></div>
      <h3>${s.name}</h3><div class="short-name">${s.short_name}</div>
      <div class="company-meta">
        <div class="meta-row"><${Icon} name="map" size=${14}/><span>${s.headquarters_address||"Not publicly available"}</span></div>
        <div class="meta-row"><${Icon} name="users" size=${14}/><span>${s.employee_size||"Not publicly available"}</span></div>
      </div>
      <div class="growth"><span>YoY growth</span><span><strong class=${negative?"negative":""}>${s.yoy_growth_rate||"Not publicly available"}</strong> <span class="arrow">→</span></span></div>
    <//>`;
  }
  function Index() {
    const navigate=useNavigate(), {choose}=useCompany();
    const [draft,setDraft]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("All"),[loading,setLoading]=useState(true),[companies,setCompanies]=useState([]),[loadError,setLoadError]=useState("");
    const loadCompanies=()=>{setLoading(true);setLoadError("");fetchCompanySummaries().then(setCompanies).catch(e=>setLoadError(errorText(e))).finally(()=>setLoading(false));};
    useEffect(()=>{loadCompanies()},[]);
    useEffect(()=>{const t=setTimeout(()=>setQuery(draft),200);return ()=>clearTimeout(t)},[draft]);
    const types=["All","Super Dream","Dream","Standard","Regular"];
    const counts=useMemo(()=>Object.fromEntries(types.map(t=>[t,t==="All"?companies.length:companies.filter(c=>(c.short_json||{}).company_type===t).length])),[companies]);
    const visible=useMemo(()=>companies.filter(c=>{
      const s=c.short_json||{}, matches=(s.name+" "+s.short_name+" "+s.category+" "+s.headquarters_address).toLowerCase().includes(query.toLowerCase());
      return matches&&(filter==="All"||s.company_type===filter);
    }),[companies,query,filter]);
    const select=(c)=>{choose(c);navigate("/company/intelligence")};
    return html`<div>
      <header class="topbar"><span class="brand-mark">J</span><span class="wordmark">JSSATEN <span style=${{color:"#94a3b8",fontWeight:500}}>Placement Intelligence</span></span><span class="spacer"></span><span class="top-pill">PUBLIC RESEARCH PORTAL</span></header>
      <section class="hero"><div class="hero-inner">
        <div class="eyebrow"><span class="eyebrow-dot"></span> JSSATEN · INTELLIGENCE PLATFORM</div>
        <h1>JSS Academy of Technical Education Companies Research & Placement Analytics Portal</h1>
        <p class="hero-sub">Your strategic edge for campus placements</p>
        <div class="search-wrap"><span class="search-icon"><${Icon} name="search" size=${19}/></span><input aria-label="Search companies" class="search" placeholder="Search companies, industries or headquarters…" value=${draft} onChange=${e=>setDraft(e.target.value)}/><button class="clear-search" style=${{display:draft?"block":"none"}} aria-label="Clear search" onClick=${()=>{setDraft("");setQuery("")}}>×</button></div>
        <div class="filters">${types.map(t=>html`<button key=${t} class=${"filter "+(filter===t?"active":"")} data-category=${t} onClick=${()=>setFilter(t)}>${t}<span class="count">${counts[t]}</span></button>`)}</div>
      </div></section>
      <main class="page-inner" style=${{padding:"0 28px"}}>
        <div class="section-heading"><div><h2>Explore companies</h2><p>Research company profiles, workplace signals and role-relevant skills.</p></div><span class="company-count">${visible.length} ${visible.length===1?"company":"companies"}</span></div>
        <div class="company-grid">${loading?Array.from({length:8},(_,i)=>html`<div key=${i} class="skeleton"></div>`):loadError?html`<div class="empty-state"><h3>Could not load companies</h3><p>${loadError}</p><button class="primary-btn" style=${{marginTop:16}} onClick=${loadCompanies}>Retry</button></div>`:visible.length?visible.map(c=>html`<${CompanyCard} key=${c.company_id} company=${c} onSelect=${select}/>`):html`<div class="empty-state"><${Icon} name="search" size=${30}/><h3>No companies found</h3><p>Try another search or clear the selected filters.</p><button class="primary-btn" style=${{marginTop:16}} onClick=${()=>{setDraft("");setQuery("");setFilter("All")}}>Reset filters</button></div>`}</div>
      </main>
      <footer class="page-footer"><span>JSSATEN · Placement Intelligence Hub</span><span>Company research for informed career decisions</span></footer>
    </div>`;
  }
  function AppSidebar() {
    const [collapsed,setCollapsed]=useState(false);
    const location=useLocation(), navigate=useNavigate(), {selected}=useCompany();
    const links=[{label:"Company Intelligence",path:"/company/intelligence",icon:"building"},{label:"Skill Intelligence",path:"/company/skills",icon:"skills"}];
    return html`<aside class=${"sidebar "+(collapsed?"collapsed":"")}>
      <div class="sidebar-label">Research tools</div>
      ${links.map(l=>html`<button key=${l.path} title=${collapsed?l.label:""} class=${"side-link "+(location.pathname===l.path?"active":"")} onClick=${()=>navigate(l.path)}><${Icon} name=${l.icon} size=${18}/><span>${l.label}</span></button>`)}
      <div class="side-spacer"></div>
      <div class="side-footer"><button class="side-link" title="All Companies" onClick=${()=>navigate("/")}><${Icon} name="home" size=${18}/><span>All Companies</span></button><button class="side-link" title="Collapse sidebar" onClick=${()=>setCollapsed(v=>!v)}><span style=${{display:"inline-flex",fontSize:17}}>${collapsed?"»":"«"}</span><span>Collapse</span></button></div>
    </aside>`;
  }
  function AppLayout({children}) {
    const navigate=useNavigate(), {selected}=useCompany();
    const [mobileMenu,setMobileMenu]=useState(false);
    return html`<div>
      <header class="topbar"><span class="brand-mark">J</span><span class="wordmark">JSSATEN <span style=${{color:"#94a3b8",fontWeight:500}}>Placement Intelligence</span></span><span class="spacer"></span><span class="top-pill">RESEARCH PORTAL</span></header>
      <div class="layout"><${AppSidebar}/>
        <main class="main"><div class="main-head"><button class="icon-btn hide-desktop" onClick=${()=>setMobileMenu(v=>!v)} aria-label="Open navigation"><${Icon} name="menu" size=${17}/></button><span>Company research</span><span style=${{color:"#cbd5e1"}}>/</span><span class="crumb-current">${selected?selected.companyName:"Selected company"}</span><span style=${{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>JSSATEN</span></div>${children}</main>
      </div>
      ${mobileMenu?html`<div class="mobile-backdrop" style=${{display:"block",position:"fixed",inset:0,zIndex:80,background:"rgba(15,23,42,.25)"}} onClick=${()=>setMobileMenu(false)}><div style=${{position:"absolute",left:0,top:0,bottom:0,width:250,background:"#f8fafc",padding:20}} onClick=${e=>e.stopPropagation()}><h3 style=${{fontSize:16,marginBottom:20}}>Research tools</h3><button class="side-link" onClick=${()=>{navigate("/company/intelligence");setMobileMenu(false)}}>▦ <span>Company Intelligence</span></button><button class="side-link" onClick=${()=>{navigate("/company/skills");setMobileMenu(false)}}>⌘ <span>Skill Intelligence</span></button><button class="side-link" onClick=${()=>navigate("/")}>⌂ <span>All Companies</span></button></div></div>`:null}
    </div>`;
  }
  function buildIntelligenceSections(profile) {
    return SECTIONS.map((s,index)=>({id:"section-"+index,title:s.title,icon:s.icon,fields:s.keys.filter(k=>Object.prototype.hasOwnProperty.call(profile,k)).map(key=>({key,label:LABELS[key]||key.replaceAll("_"," "),value:profile[key]}))}));
  }
  function isNullish(value) {
    if(value===null||value===undefined)return true;
    const s=String(value).trim().toLowerCase();
    return ["","na","n/a","none","-","null","undefined","not publicly available"].includes(s);
  }
  function asString(v){return v===null||v===undefined?"":String(v)}
  function asRecord(v){return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}
  function splitItems(value) {
    return asString(value).split(/[\n;•]+/).map(s=>s.trim()).filter(Boolean);
  }
  function titleCaseFromCode(value){return asString(value).replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
  function scoreToDifficulty(score){return score>=8?"EXPERT":score>=6?"ADVANCED":score>=4?"PRO":"BEGINNER"}
  function normalizeCompanySummary(short_json){const s=asRecord(short_json);return {company_id:s.company_id,name:s.name||"",short_name:s.short_name||"",logo_url:s.logo_url||"",category:s.category||"",company_type:s.company_type||"Regular",headquarters_address:s.headquarters_address||"",employee_size:s.employee_size||"",yoy_growth_rate:s.yoy_growth_rate||""}}
  function normalizeCompanyProfile(full_json,short_json){return Object.assign({},asRecord(short_json),asRecord(full_json))}
  function normalizeDashboardSkills(skillLevels){return (skillLevels||[]).map(s=>({...s,id:s.skill_set_id,name:s.skill_set_name,score:Number(s.required_level)||1,proficiency:s.required_proficiency||"",required_level:Number(s.required_level)||1,required_proficiency:s.required_proficiency||""}))}
  function renderValue(field) {
    const value=field.value,key=field.key;
    if(isNullish(value)) return html`<span class="value-pill"><${Icon} name="check" size=${11}/> Not Available</span>`;
    const text=String(value);
    const urlLike=/url$/.test(key)||/^https?:\/\//i.test(text);
    if(urlLike) return html`<a href=${/^https?:\/\//i.test(text)?text:"https://"+text} target="_blank" rel="noreferrer">${text.replace(/^https?:\/\//,"").replace(/\/$/,"")} <span aria-hidden="true">↗</span></a>`;
    if(key==="primary_contact_email"||key==="contact_person_email") return html`<a href=${"mailto:"+text}>${text}</a>`;
    if(key==="primary_phone_number"||key==="contact_person_phone") return html`<a href=${"tel:"+text.replace(/[^+\d]/g,"")}>${text}</a>`;
    if(/rating$/.test(key)||["glassdoor_rating","indeed_rating","google_rating"].includes(key)) return html`<span class="rating-chip">★ ${text}</span>`;
    const items=splitItems(text);
    const paragraphKeys=["overview_text","vision_statement","mission_statement","core_value_proposition","brand_sentiment_score","ai_ml_adoption_level","decision_maker_access","website_quality","legal_issues","future_projections","carbon_footprint","ethical_sourcing"];
    const pillItems=["focus_sectors","operating_countries","technology_partners","key_competitors","industry_associations","event_participation","core_values","public_transport_access","flexibility_level","tech_stack","partnership_ecosystem"];
    if(paragraphKeys.includes(key)||text.length>175&&items.length===1)return html`<p class="value-paragraph">${text}</p>`;
    if(pillItems.includes(key)||items.length>1&&text.length<220)return html`<div class="value-list">${items.map((item,i)=>html`<span key=${i} class="value-chip">${item}</span>`)}</div>`;
    return html`<span>${text}</span>`;
  }
  function FieldRow({field}) {
    return html`<div class="field-row"><div class="field-label">${field.label}</div><div class="field-value">${renderValue(field)}</div></div>`;
  }
  function SectionCard({section,index}) {
    return html`<section id=${section.id} class=${"intel-card "+([1,11,17].includes(index)?"full":"")} data-section=${index}>
      <div class="intel-head"><span class="section-icon"><${Icon} name=${section.icon} size=${17}/></span><div><h2>${section.title}</h2><p>Company profile and research details</p></div><span class="section-count">${section.fields.length} fields</span></div>
      <div class="field-list">${section.fields.length?section.fields.map(f=>html`<${FieldRow} key=${f.key} field=${f}/>`):html`<div class="field-row"><div class="field-label">Profile details</div><div class="field-value"><span class="value-pill">Not Available</span></div></div>`}</div>
    </section>`;
  }
  function CompanyIntelligence() {
    const {selected}=useCompany(), navigate=useNavigate();
    const [company,setCompany]=useState(selected?selected.company:null),[profileLoading,setProfileLoading]=useState(true),[profileError,setProfileError]=useState("");
    const [active,setActive]=useState(0),isScrollingRef=useRef(false);
    const reloadProfile=()=>{if(!selected)return;setProfileLoading(true);setProfileError("");fetchCompanyProfile(selected.companyId).then(row=>{const next={...row,skill_levels:[]};setCompany(next)}).catch(e=>setProfileError(errorText(e))).finally(()=>setProfileLoading(false));};
    useEffect(()=>{reloadProfile()},[selected&&selected.companyId]);
    const profile=normalizeCompanyProfile(company&&company.full_json,company&&company.short_json);
    const sections=useMemo(()=>buildIntelligenceSections(profile),[company]);
    useEffect(()=>{
      const observer=new IntersectionObserver(entries=>{
        if(isScrollingRef.current)return;
        const inView=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
        if(inView){const idx=Number(inView.target.dataset.section);if(Number.isFinite(idx))setActive(idx)}
      },{rootMargin:"-155px 0px -62% 0px",threshold:[0,.15,.35,.6]});
      sections.forEach((s,i)=>{const el=document.getElementById(s.id);if(el){el.dataset.section=String(i);observer.observe(el)}});
      return ()=>observer.disconnect();
    },[sections]);
    if(profileLoading)return html`<div class="content"><div class="skeleton" style=${{height:150,marginBottom:18}}></div><div class="skeleton" style=${{height:320}}></div></div>`;
    if(profileError)return html`<div class="content"><div class="empty-state"><h3>Could not load company profile</h3><p>${profileError}</p><button class="primary-btn" onClick=${reloadProfile}>Retry</button></div></div>`;
    if(!company||!company.full_json)return html`<div class="content"><div class="empty-state"><h3>Company profile unavailable</h3><p>The selected company did not return a full_json profile.</p><button class="primary-btn" onClick=${()=>navigate("/")}>Back to companies</button></div></div>`;
    // active-tab state is declared before the loading guards above.
    // Intersection observer is declared above the loading guards.
    const scrollToSection=(i)=>{setActive(i);isScrollingRef.current=true;const el=document.getElementById(sections[i].id);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});const tab=document.getElementById("tab-"+i);if(tab)tab.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});setTimeout(()=>{isScrollingRef.current=false},850)};
    return html`<div>
      <div class="company-info"><${CompanyLogo} company=${company}/><div><div class="company-info-name">${profile.name}</div><div class="company-info-sub">${profile.category||"Company profile"} · ${profile.headquarters_address||"Global"}</div></div><span class="company-info-spacer"></span><a class="external-btn" target="_blank" rel="noreferrer" href=${profile.website_url}><${Icon} name="external" size=${14}/> Website</a><a class="external-btn" target="_blank" rel="noreferrer" href=${profile.linkedin_url}><${Icon} name="external" size=${14}/> LinkedIn</a>
      </div>
      <div class="content">
        <div class="detail-intro"><div><div class="eyebrow"><span class="eyebrow-dot"></span> COMPANY PROFILE</div><h1>Company Intelligence</h1><p>Structured research across company identity, culture, technology and career growth.</p></div><span class="data-note">Supabase · Live data</span></div>
        <div class="tabs-shell"><nav class="tabs" aria-label="Company intelligence sections">${sections.map((s,i)=>html`<button id=${"tab-"+i} key=${s.id} class=${"tab "+(active===i?"active":"")} onClick=${()=>scrollToSection(i)}>${s.title}</button>`)}</nav></div>
        <div class="intelligence-grid" style=${{paddingTop:18}}>${sections.map((s,i)=>html`<${SectionCard} key=${s.id} section=${s} index=${i}/>`)}</div>
      </div>
    </div>`;
  }
  function proficiencyToBloom(score){if(score<=2)return BLOOM[0];if(score<=4)return BLOOM[1];if(score<=6)return BLOOM[2];if(score<=8)return BLOOM[3];return BLOOM[4]}
  function scoreToCriticality(score){return score>=7?{name:"Critical",color:"#b91c1c",bg:"#fef2f2"}:score>=5?{name:"Important",color:"#b45309",bg:"#fffbeb"}:{name:"Baseline",color:"#15803d",bg:"#f0fdf4"}}
  function SkillCard({skill,open,toggle}) {
    const bloom=proficiencyToBloom(skill.required_level),critical=scoreToCriticality(skill.required_level);
    const topics=skill.topics||Array.from({length:10},(_,i)=>"Skill foundations and applied practice · Level "+(i+1));
    return html`<article class="skill-card">
      <div class="skill-card-head"><span class="skill-icon"><${Icon} name="skills" size=${17}/></span><div class="skill-main"><div class="skill-name">${skill.skill_set_name}</div><div class="skill-meta"><span class="bloom-badge" style=${{background:bloom.bg,color:bloom.color}}>${bloom.code} · ${bloom.name}</span><span class="criticality-badge" style=${{background:critical.bg,color:critical.color}}>${critical.name}</span></div></div><div class="skill-score">${skill.required_level}<small>/10</small></div></div>
      <div class="skill-progress"><div style=${{width:(skill.required_level*10)+"%",background:bloom.color}}></div></div>
      <div class="skill-target"><span>Target proficiency: <strong style=${{color:"#334155"}}>${skill.required_proficiency}</strong></span><span>${scoreToDifficulty(skill.required_level)}</span></div>
      <button class="roadmap-toggle" onClick=${toggle} aria-expanded=${open}><span>${open?"Hide":"Explore"} 10-level learning roadmap</span><span>${open?"−":"+"}</span></button>
      ${open?html`<div class="roadmap">${topics.map((topic,i)=>{const level=i+1,locked=level>skill.required_level;return html`<div key=${level} class=${"roadmap-row "+(locked?"locked":"")}><span class=${"level-number "+(locked?"locked":"")}>${locked?"⌑":level}</span><div><div class="roadmap-topic">${topic}</div><div class="roadmap-status">${locked?"Beyond scope":level<=3?"Fundamentals":level<=7?"Intermediate":"Advanced / applied"}</div></div></div>`})}</div>`:null}
    </article>`;
  }
  function SkillIntelligence() {
    const {selected}=useCompany(),[expanded,setExpanded]=useState({}),[skills,setSkills]=useState([]),[skillsLoading,setSkillsLoading]=useState(true),[skillsError,setSkillsError]=useState("");
    const company=selected.company;
    const loadSkills=()=>{setSkillsLoading(true);setSkillsError("");fetchCompanySkills(selected.companyId).then(setSkills).catch(e=>setSkillsError(errorText(e))).finally(()=>setSkillsLoading(false));};
    useEffect(()=>{loadSkills()},[selected&&selected.companyId]);
    if(skillsLoading)return html`<div class="content"><div class="skeleton" style=${{height:120,marginBottom:18}}></div><div class="skeleton" style=${{height:180,marginBottom:12}}></div><div class="skeleton" style=${{height:180}}></div></div>`;
    if(skillsError)return html`<div class="content"><div class="empty-state"><h3>Could not load skill intelligence</h3><p>${skillsError}</p><button class="primary-btn" onClick=${loadSkills}>Retry</button></div></div>`;
    return html`<div class="content">
      <div class="skill-header"><${CompanyLogo} company=${company} className="skill-logo"/><div><div class="eyebrow" style=${{marginBottom:7}}>ROLE-RELEVANT PREPARATION</div><h1>${company.short_json.short_name} Skill Intelligence</h1><p>Competency targets and structured learning roadmaps for placement preparation.</p></div></div>
      <div class="legend-card"><div class="legend-title">Bloom learning levels</div><div class="bloom-legend">${BLOOM.map(b=>html`<div key=${b.code} class="bloom-item"><span class="bloom-code" style=${{background:b.color}}>${b.code}</span><span><strong>${b.name}</strong></span></div>`)}</div></div>
      <div class="legend-card"><div class="legend-title">Skill criticality</div><div class="criticality-legend"><div class="criticality"><span class="criticality-dot" style=${{background:"#dc2626"}}></span><div><strong>Critical</strong><span>Score 7–10</span></div></div><div class="criticality"><span class="criticality-dot" style=${{background:"#d97706"}}></span><div><strong>Important</strong><span>Score 5–6</span></div></div><div class="criticality"><span class="criticality-dot" style=${{background:"#16a34a"}}></span><div><strong>Baseline</strong><span>Score 1–4</span></div></div></div></div>
      <div class="section-heading"><div><h2>Required skills</h2><p>Expand a skill to view the 10-level topic ladder. Rows above the target are marked beyond scope.</p></div><span class="company-count">${skills.length} skills</span></div>
      <div class="skill-list">${skills.map(skill=>html`<${SkillCard} key=${skill.skill_set_id} skill=${skill} open=${!!expanded[skill.skill_set_id]} toggle=${()=>setExpanded(s=>({...s,[skill.skill_set_id]:!s[skill.skill_set_id]}))}/>`)}</div>
    </div>`;
  }
  function CompanyGate({children}) {
    const {selected}=useCompany();
    return selected?children:html`<${Navigate} to="/" replace/>`;
  }
  function NotFound() {
    const navigate=useNavigate();
    return html`<div><header class="topbar"><span class="brand-mark">J</span><span class="wordmark">JSSATEN Placement Intelligence</span></header><div class="not-found"><div><span class="brand-mark" style=${{margin:"0 auto",width:50,height:50}}>?</span><h1>Page not found</h1><p style=${{color:"#64748b",marginBottom:18}}>The page you requested does not exist.</p><button class="primary-btn" onClick=${()=>navigate("/")}>Return to all companies</button></div></div></div>`;
  }
  function App() {
    return html`<${CompanyProvider}><${BrowserRouter}><${Routes}>
      <${Route} path="/" element=${html`<${Index}/>`}/>
      <${Route} path="/company" element=${html`<${Navigate} to="/company/intelligence" replace/>`}/>
      <${Route} path="/company/intelligence" element=${html`<${AppLayout}><${CompanyGate}><${CompanyIntelligence}/><//><//>`}/>
      <${Route} path="/company/skills" element=${html`<${AppLayout}><${CompanyGate}><${SkillIntelligence}/><//><//>`}/>
      <${Route} path="*" element=${html`<${NotFound}/>`}/>
    <//><//><//>`;
  }
  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);
})();