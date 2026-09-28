export const SHAPES = [
  { id: 'process', label: '프로세스', category: 'Flow', keywords: '작업 step action rectangle process', w: 180, h: 84 },
  { id: 'subprocess', label: '서브프로세스', category: 'Flow', keywords: 'subprocess predefined process module 서브프로세스 하위 프로세스', w: 190, h: 88 },
  { id: 'decision', label: '의사결정', category: 'Flow', keywords: '조건 분기 yes no diamond decision', w: 160, h: 112 },
  { id: 'gateway', label: '게이트웨이', category: 'Flow', keywords: 'gateway merge split xor parallel 게이트웨이 분기 병합', w: 130, h: 100 },
  { id: 'terminator', label: '시작 / 종료', category: 'Flow', keywords: 'start end terminator pill 시작 종료', w: 170, h: 72 },
  { id: 'io', label: '입력 / 출력', category: 'Flow', keywords: 'input output data parallelogram 입력 출력', w: 180, h: 84 },
  { id: 'manual-input', label: '수동 입력', category: 'Flow', keywords: 'manual input keyboard form 수동 입력', w: 180, h: 84 },
  { id: 'delay', label: '대기 / 지연', category: 'Flow', keywords: 'delay wait timer pause 대기 지연', w: 165, h: 84 },
  { id: 'offpage', label: '페이지 연결', category: 'Flow', keywords: 'off page connector link continue 페이지 연결 이동', w: 120, h: 104 },
  { id: 'database', label: '데이터베이스', category: 'Data', keywords: 'database storage cylinder db 데이터 저장', w: 170, h: 104 },
  { id: 'table', label: '데이터 테이블', category: 'Data', keywords: 'table rows columns spreadsheet dataset 표 데이터', w: 190, h: 118 },
  { id: 'queue', label: '큐 / 스트림', category: 'Data', keywords: 'queue stream kafka message broker event 큐 스트림 이벤트', w: 185, h: 92 },
  { id: 'document', label: '문서', category: 'Data', keywords: 'document file paper 문서 파일', w: 170, h: 100 },
  { id: 'folder', label: '폴더', category: 'Data', keywords: 'folder directory files storage 폴더 디렉터리', w: 180, h: 104 },
  { id: 'package', label: '패키지', category: 'Data', keywords: 'package module box artifact npm 패키지 모듈', w: 160, h: 116 },
  { id: 'note', label: '메모', category: 'Annotation', keywords: 'note memo sticky annotation 메모 노트', w: 170, h: 108 },
  { id: 'callout', label: '말풍선', category: 'Annotation', keywords: 'callout speech comment annotation feedback 말풍선 코멘트', w: 190, h: 104 },
  { id: 'card', label: '카드', category: 'Basic', keywords: 'card panel tile container 카드 패널', w: 190, h: 112 },
  { id: 'circle', label: '원형', category: 'Basic', keywords: 'circle ellipse round event 원 원형', w: 112, h: 112 },
  { id: 'triangle', label: '삼각형', category: 'Basic', keywords: 'triangle warning delta 삼각형 경고', w: 130, h: 112 },
  { id: 'hexagon', label: '육각형', category: 'Basic', keywords: 'hexagon preparation service 육각형', w: 170, h: 96 },
  { id: 'star', label: '별', category: 'Basic', keywords: 'star favorite highlight milestone 별 중요', w: 120, h: 116 },
  { id: 'cloud', label: '클라우드', category: 'Architecture', keywords: 'cloud internet external service 클라우드 외부', w: 180, h: 104 },
  { id: 'server', label: '서버', category: 'Architecture', keywords: 'server compute rack backend host 서버 백엔드', w: 170, h: 112 },
  { id: 'browser', label: '브라우저', category: 'Architecture', keywords: 'browser web client frontend window 브라우저 웹 프론트', w: 190, h: 120 },
  { id: 'mobile', label: '모바일', category: 'Architecture', keywords: 'mobile phone app device 스마트폰 모바일 앱', w: 104, h: 150 },
  { id: 'laptop', label: '노트북', category: 'Architecture', keywords: 'laptop desktop client computer 노트북 컴퓨터', w: 180, h: 118 },
  { id: 'actor', label: '사용자 / Actor', category: 'Architecture', keywords: 'actor user person customer 사용자 사람 고객', w: 110, h: 140 },
  { id: 'shield', label: '보안 경계', category: 'Architecture', keywords: 'shield security auth firewall protection 보안 인증 방화벽', w: 130, h: 126 },
  { id: 'image', label: '이미지 영역', category: 'Media', keywords: 'image photo media placeholder 이미지 사진 미디어', w: 190, h: 120 },
  { id: 'group', label: '그룹', category: 'Container', keywords: 'group container frame boundary 그룹 컨테이너', w: 280, h: 180 },
  { id: 'swimlane', label: '스윔레인', category: 'Container', keywords: 'swimlane lane role process 역할 레인', w: 360, h: 180 }
];


const icon = (id,label,category,keywords,content) => ({id,label,category,keywords,viewBox:'0 0 24 24',content:`<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${content}</g>`});

export const BUILTIN_ICONS = [
  icon('person','사람','People','person user account 사람 사용자','<circle cx="12" cy="7" r="3"/><path d="M5.5 20c.7-4.2 3-6.3 6.5-6.3s5.8 2.1 6.5 6.3"/>'),
  icon('team','팀','People','team users group people 팀 사람 그룹','<circle cx="9" cy="7.3" r="2.6"/><circle cx="16.8" cy="8.6" r="2.1"/><path d="M3.8 19c.6-3.8 2.5-5.7 5.4-5.7s4.9 1.9 5.5 5.7M14.2 14.5c2.9-.7 5 .9 5.8 3.8"/>'),
  icon('building','조직','People','company organization office building 조직 회사','<path d="M5 21V5h9v16M14 9h5v12M8 8h2M8 12h2M8 16h2M16 12h1M16 16h1M3 21h18"/>'),
  icon('server','서버','System','server backend compute host 서버 백엔드','<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/>'),
  icon('database','DB','System','database storage sql db 데이터베이스','<ellipse cx="12" cy="5.5" rx="7" ry="3"/><path d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6M5 11.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
  icon('cloud','클라우드','System','cloud internet external 클라우드 인터넷','<path d="M7.2 18.3H17a4 4 0 0 0 .4-8 5.7 5.7 0 0 0-10.7-1.5A4.8 4.8 0 0 0 7.2 18.3Z"/>'),
  icon('api','API','System','api endpoint rest integration interface','<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
  icon('queue','메시지 큐','System','queue broker event kafka message 큐 메시지','<path d="M5 7h10M5 12h14M5 17h8"/><path d="m15 5 2 2-2 2M19 10l2 2-2 2M13 15l2 2-2 2"/>'),
  icon('browser','브라우저','Device','browser web frontend client 브라우저 웹','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>'),
  icon('phone','모바일','Device','phone mobile app smartphone 모바일 스마트폰','<rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/><path d="M10 5h4M11 18.7h2"/>'),
  icon('laptop','노트북','Device','laptop desktop computer device 노트북 컴퓨터','<rect x="5" y="4" width="14" height="11" rx="1.5"/><path d="M3 19h18l-2-4H5l-2 4Z"/>'),
  icon('router','라우터','Device','router network wifi gateway 라우터 네트워크','<rect x="4" y="12" width="16" height="7" rx="2"/><path d="M8 15h.01M12 15h.01M16 15h.01M8 12V7M16 12V7M6 5c3.4-2.7 8.6-2.7 12 0M9 8c1.7-1.3 4.3-1.3 6 0"/>'),
  icon('globe','인터넷','Device','globe internet world global 인터넷 글로벌','<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.7 2.7 4 5.7 4 9s-1.3 6.3-4 9c-2.7-2.7-4-5.7-4-9s1.3-6.3 4-9Z"/>'),
  icon('shield','보안','Security','shield security auth firewall 보안 인증','<path d="M12 3 19 6v5.1c0 4.6-2.8 7.8-7 9.9-4.2-2.1-7-5.3-7-9.9V6l7-3Z"/><path d="m9 12 2 2 4-5"/>'),
  icon('lock','잠금','Security','lock secure private permission 잠금 보안 권한','<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/>'),
  icon('key','키','Security','key access credential secret 키 접근 자격','<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3M20 12v2"/>'),
  icon('check','완료','Status','check success done complete 완료 성공','<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>'),
  icon('warning','경고','Status','warning alert incident risk 경고 오류 위험','<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>'),
  icon('info','정보','Status','info information help 정보 안내','<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 7h.01"/>'),
  icon('clock','시간','Status','clock time schedule timer 시간 일정','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  icon('mail','메일','Communication','mail email message envelope 메일 이메일','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'),
  icon('chat','대화','Communication','chat message comment support 대화 메시지','<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/>'),
  icon('webhook','웹훅','Communication','webhook event integration trigger 웹훅 이벤트','<circle cx="8" cy="7" r="3"/><circle cx="17" cy="16" r="3"/><path d="M10 9.2 15 14M7 10v5a4 4 0 0 0 4 4h3M17 13V8a4 4 0 0 0-4-4h-2"/>'),
  icon('calendar','캘린더','Communication','calendar date schedule plan 캘린더 일정','<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M8 13h2M14 13h2M8 17h2"/>'),
  icon('file','파일','Content','file document page content 파일 문서','<path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v5h5M10 12h5M10 16h5"/>'),
  icon('folder','폴더','Content','folder files directory 폴더 파일','<path d="M3 7h7l2 2h9v10H3V7Z"/><path d="M3 7V5h7l2 2"/>'),
  icon('package','패키지','Content','package artifact module box 패키지 모듈','<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
  icon('image','이미지','Content','image photo media picture 이미지 사진','<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/>'),
  icon('search','검색','Action','search find lookup magnifier 검색 찾기','<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
  icon('gear','설정','Action','gear settings config tool 설정 구성','<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="7"/>'),
  icon('chart','차트','Action','chart analytics metrics graph 분석 차트 지표','<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  icon('spark','아이디어','Action','spark idea ai magic star 아이디어 AI','<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3ZM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/>')
];

export const THEMES = [
  {
    id: 'minimal', label: 'Minimal', description: '명확한 경계와 중립 배경',
    tokens: { canvas:'#f7f8fb', grid:'#dfe3ea', surface:'#ffffff', text:'#172033', muted:'#667085', primary:'#5b5cf0', accent:'#0ea5e9', border:'#aeb8c7', edge:'#64748b', radius:16, nodeStrokeWidth:1.6, fontFamily:'Inter, Pretendard, system-ui, sans-serif' }
  },
  {
    id: 'blueprint', label: 'Blueprint', description: '설계도 같은 구조 표현',
    tokens: { canvas:'#0a2540', grid:'#204765', surface:'#113b5c', text:'#ecf8ff', muted:'#9bc1d9', primary:'#66d9ff', accent:'#89f0cf', border:'#5ab1d8', edge:'#7dd3fc', radius:10, nodeStrokeWidth:1.8, fontFamily:'Inter, Pretendard, system-ui, sans-serif' }
  },
  {
    id: 'paper', label: 'Paper', description: '문서·워크숍에 어울리는 따뜻한 톤',
    tokens: { canvas:'#f4efe4', grid:'#d9cfbd', surface:'#fffaf0', text:'#2f2a24', muted:'#776f66', primary:'#b45309', accent:'#0f766e', border:'#cbbda9', edge:'#7c6f64', radius:6, nodeStrokeWidth:1.5, fontFamily:'Georgia, "Noto Serif KR", serif' }
  },
  {
    id: 'soft', label: 'Soft', description: '부드러운 표면과 여유로운 흐름',
    tokens: { canvas:'#f6f3ff', grid:'#e1daf5', surface:'#ffffff', text:'#2c2640', muted:'#756d8f', primary:'#7c3aed', accent:'#ec4899', border:'#c9b9ea', edge:'#8b7faa', radius:24, nodeStrokeWidth:1.3, fontFamily:'Inter, Pretendard, system-ui, sans-serif' }
  },
  {
    id: 'dark', label: 'Dark', description: '발표·기술 문서에 적합한 다크',
    tokens: { canvas:'#111318', grid:'#2b3038', surface:'#1d2128', text:'#f3f5f7', muted:'#9ba3af', primary:'#8b91ff', accent:'#4fd1c5', border:'#48515e', edge:'#a3adba', radius:14, nodeStrokeWidth:1.5, fontFamily:'Inter, Pretendard, system-ui, sans-serif' }
  },
  {
    id: 'contrast', label: 'High Contrast', description: '명확한 구분과 인쇄 친화',
    tokens: { canvas:'#ffffff', grid:'#d6d6d6', surface:'#ffffff', text:'#000000', muted:'#404040', primary:'#0037ff', accent:'#007a3d', border:'#000000', edge:'#000000', radius:4, nodeStrokeWidth:2.2, fontFamily:'Arial, "Noto Sans KR", sans-serif' }
  }
];

const baseNode = (id, type, x, y, label, extra={}) => ({ id, type, x, y, label, ...extra });
const edge = (id, source, target, label='', extra={}) => ({ id, source, target, sourcePort:'right', targetPort:'left', label, routing:'orthogonal', ...extra });

export const TEMPLATES = [
  {
    id:'product-flow', name:'제품 온보딩 흐름', category:'Flow', keywords:'onboarding product user flow 가입 시작 activation', theme:'minimal',
    nodes:[
      baseNode('n1','terminator',80,180,'방문'),
      baseNode('n2','process',310,180,'가입 / 로그인'),
      baseNode('n3','decision',560,166,'핵심 설정 완료?'),
      baseNode('n4','process',820,80,'가이드 제공'),
      baseNode('n5','process',820,250,'첫 작업 생성'),
      baseNode('n6','terminator',1080,250,'활성 사용자')
    ],
    edges:[edge('e1','n1','n2'),edge('e2','n2','n3'),edge('e3','n3','n4','아니오'),edge('e4','n3','n5','예'),edge('e5','n4','n5'),edge('e6','n5','n6')]
  },
  {
    id:'approval-flow', name:'승인 프로세스', category:'Process', keywords:'approval review request 승인 검토 결재', theme:'paper',
    nodes:[
      baseNode('n1','terminator',80,180,'요청 접수'),
      baseNode('n2','process',320,180,'담당자 검토'),
      baseNode('n3','decision',580,166,'기준 충족?'),
      baseNode('n4','process',850,70,'수정 요청'),
      baseNode('n5','process',850,260,'승인 처리'),
      baseNode('n6','terminator',1110,260,'완료')
    ],
    edges:[edge('e1','n1','n2'),edge('e2','n2','n3'),edge('e3','n3','n4','아니오'),edge('e4','n4','n2','재검토',{sourcePort:'left',targetPort:'top'}),edge('e5','n3','n5','예'),edge('e6','n5','n6')]
  },
  {
    id:'system-map', name:'서비스 시스템 맵', category:'Architecture', keywords:'system architecture api database cloud client 시스템 아키텍처', theme:'blueprint',
    nodes:[
      baseNode('n1','process',100,160,'Web Client'),
      baseNode('n2','process',380,80,'API Gateway'),
      baseNode('n3','process',380,250,'Worker'),
      baseNode('n4','database',680,70,'Primary DB'),
      baseNode('n5','database',680,250,'Event Store'),
      baseNode('n6','cloud',980,155,'External API')
    ],
    edges:[edge('e1','n1','n2','HTTPS'),edge('e2','n2','n4','Read / Write'),edge('e3','n2','n3','Queue'),edge('e4','n3','n5','Append'),edge('e5','n2','n6','REST')]
  },
  {
    id:'mind-map', name:'아이디어 맵', category:'Brainstorm', keywords:'mind map idea brainstorm concept 아이디어 마인드맵', theme:'soft',
    nodes:[
      baseNode('n1','circle',520,220,'핵심 아이디어',{w:150,h:150}),
      baseNode('n2','note',180,80,'사용자 문제'),
      baseNode('n3','note',180,350,'가치 제안'),
      baseNode('n4','note',850,80,'기능'),
      baseNode('n5','note',850,350,'검증')
    ],
    edges:[edge('e1','n1','n2','',{sourcePort:'left',targetPort:'right',routing:'bezier'}),edge('e2','n1','n3','',{sourcePort:'left',targetPort:'right',routing:'bezier'}),edge('e3','n1','n4','',{sourcePort:'right',targetPort:'left',routing:'bezier'}),edge('e4','n1','n5','',{sourcePort:'right',targetPort:'left',routing:'bezier'})]
  },
  {
    id:'swimlane-process', name:'역할별 업무 흐름', category:'Process', keywords:'swimlane role team workflow 업무 역할 팀', theme:'minimal',
    nodes:[
      baseNode('lane1','swimlane',60,50,'고객',{w:1100,h:170}),
      baseNode('lane2','swimlane',60,245,'운영팀',{w:1100,h:170}),
      baseNode('n1','process',170,95,'문의 등록'),
      baseNode('n2','process',440,95,'추가 정보 전달'),
      baseNode('n3','process',290,290,'문의 확인'),
      baseNode('n4','decision',590,275,'처리 가능?'),
      baseNode('n5','process',860,290,'답변 발송')
    ],
    edges:[edge('e1','n1','n3','',{sourcePort:'bottom',targetPort:'top'}),edge('e2','n3','n4'),edge('e3','n4','n2','보완',{sourcePort:'top',targetPort:'bottom'}),edge('e4','n2','n3','',{sourcePort:'bottom',targetPort:'top'}),edge('e5','n4','n5','처리')]
  }
];

export const DEFAULT_SETTINGS = {
  grid: true,
  snap: true,
  gridSize: 20,
  routing: 'orthogonal',
  layoutDirection: 'LR',
  horizontalGap: 110,
  verticalGap: 70,
  exportBackground: true,
  exportScale: 2
};
