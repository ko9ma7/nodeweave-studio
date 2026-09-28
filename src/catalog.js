export const SHAPES = [
  { id: 'process', label: '프로세스', category: 'Flow', keywords: '작업 step action rectangle process', w: 180, h: 84 },
  { id: 'decision', label: '의사결정', category: 'Flow', keywords: '조건 분기 yes no diamond decision', w: 160, h: 112 },
  { id: 'terminator', label: '시작 / 종료', category: 'Flow', keywords: 'start end terminator pill 시작 종료', w: 170, h: 72 },
  { id: 'io', label: '입력 / 출력', category: 'Flow', keywords: 'input output data parallelogram 입력 출력', w: 180, h: 84 },
  { id: 'database', label: '데이터베이스', category: 'Data', keywords: 'database storage cylinder db 데이터 저장', w: 170, h: 104 },
  { id: 'document', label: '문서', category: 'Data', keywords: 'document file paper 문서 파일', w: 170, h: 100 },
  { id: 'note', label: '메모', category: 'Annotation', keywords: 'note memo sticky annotation 메모 노트', w: 170, h: 108 },
  { id: 'circle', label: '원형', category: 'Basic', keywords: 'circle ellipse round event 원 원형', w: 112, h: 112 },
  { id: 'hexagon', label: '육각형', category: 'Basic', keywords: 'hexagon preparation service 육각형', w: 170, h: 96 },
  { id: 'cloud', label: '클라우드', category: 'Architecture', keywords: 'cloud internet external service 클라우드 외부', w: 180, h: 104 },
  { id: 'group', label: '그룹', category: 'Container', keywords: 'group container frame boundary 그룹 컨테이너', w: 280, h: 180 },
  { id: 'swimlane', label: '스윔레인', category: 'Container', keywords: 'swimlane lane role process 역할 레인', w: 360, h: 180 }
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
