export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  pdfUrl?: string; // or dynamic generator
  csvText: string;
  canvasObjects: any[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'conference-badge',
    name: 'Conference Attendee Badge',
    description: 'Event badge with dynamic QR code and attendee details',
    csvText: `First_Name,Last_Name,Company,Role,Ticket_ID
Sarah,Chen,Aura Robotics,Speaker,TCK-88219
Marcus,Vance,Starlight Media,VIP,TCK-99412
Elena,Rostova,Global FinTech,Attendee,TCK-33104
David,Kim,Apex Labs,Speaker,TCK-11209`,
    canvasObjects: [
      {
        type: 'textbox',
        text: '{{First_Name}} {{Last_Name}}',
        rawTemplateTag: '{{First_Name}} {{Last_Name}}',
        left: 285,
        top: 260,
        fontSize: 34,
        fill: '#0f172a',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 280,
      },
      {
        type: 'textbox',
        text: '{{Company}}',
        rawTemplateTag: '{{Company}}',
        left: 285,
        top: 315,
        fontSize: 18,
        fill: '#64748b',
        fontWeight: 'normal',
        textAlign: 'center',
        width: 280,
      },
      {
        type: 'textbox',
        text: '{{Role}}',
        rawTemplateTag: '{{Role}}',
        left: 285,
        top: 355,
        fontSize: 16,
        fill: '#0284c7',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 280,
        rules: [
          {
            id: 'rule-vip',
            operator: 'equals',
            value: 'VIP',
            color: '#d97706',
            isBold: true,
          },
          {
            id: 'rule-speaker',
            operator: 'equals',
            value: 'Speaker',
            color: '#7c3aed',
            isBold: true,
          },
        ],
      },
    ],
  },
  {
    id: 'certificate-service',
    name: 'Certificate of Achievement',
    description: 'Formal award certificate with date and issuer',
    csvText: `Recipient_Name,Years_Of_Service,Date,Presented_By
Alexander Wright,10,October 24 2026,Neogen Executive Board
Jordan Hayes,5,October 24 2026,Neogen Executive Board
Maya Patel,15,October 24 2026,Neogen Executive Board`,
    canvasObjects: [
      {
        type: 'textbox',
        text: '{{Recipient_Name}}',
        rawTemplateTag: '{{Recipient_Name}}',
        left: 225,
        top: 480,
        fontSize: 38,
        fill: '#064e3b',
        fontFamily: 'Playfair_Display',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 400,
      },
      {
        type: 'textbox',
        text: 'In recognition of {{Years_Of_Service}} years of excellence',
        rawTemplateTag: 'In recognition of {{Years_Of_Service}} years of excellence',
        left: 225,
        top: 550,
        fontSize: 16,
        fill: '#334155',
        textAlign: 'center',
        width: 400,
      },
    ],
  },
];
