/* Datos de ejemplo del panel. Todo vive en memoria: al recargar la página se restablecen. */
window.Z = window.Z || {};

Z.TODAY = '2026-10-20';
Z.IMG = '../img/';

Z.ZONES = ['Arbolada', 'Residencial Cumbres', 'Santa Fe', 'Lagos del Sol', 'Aqua Residencial', 'Jardines del Sur', 'Huayacán'];
Z.TYPES = ['Casa', 'Casa en condominio', 'Townhouse'];
Z.AMENITIES = ['Jardín privado', 'Cocina integral', 'Acceso controlado 24/7', 'Se aceptan mascotas', 'Alberca', 'Casa club', 'Amueblada', 'Terraza'];

Z.STATUS = {
  disponible: { label: 'Disponible', tone: 'ok' },
  reservada: { label: 'Reservada', tone: 'warn' },
  rentada: { label: 'Rentada', tone: 'gris' },
  borrador: { label: 'Borrador', tone: 'gris' }
};
Z.APPT_STATUS = {
  confirmada: { label: 'Confirmada', tone: 'ok' },
  'por-confirmar': { label: 'Por confirmar', tone: 'warn' },
  realizada: { label: 'Realizada', tone: 'gris' },
  cancelada: { label: 'Cancelada', tone: 'error' }
};
Z.FOLLOW = {
  'Visita confirmada': 'gris',
  'Por confirmar': 'warn',
  'Contrato vigente': 'ok',
  'Reservada': 'gris',
  'En seguimiento': 'gris',
  'Nuevo contacto': 'gris'
};

Z.data = {
  brokers: [
    { id: 'mariana', name: 'Mariana Solís', initials: 'MS', role: 'Rentas · Arbolada y Aqua', zones: 'Arbolada · Aqua Residencial', email: 'mariana@zugar.example', phone: '+52 998 555 0101', photo: 'asesora-mariana-solis.jpg', active: true },
    { id: 'diego', name: 'Diego Herrera', initials: 'DH', role: 'Ventas · Cumbres y Lagos del Sol', zones: 'Cumbres · Lagos del Sol', email: 'diego@zugar.example', phone: '+52 998 555 0102', photo: '', active: true },
    { id: 'valeria', name: 'Valeria Cruz', initials: 'VC', role: 'Rentas y ventas · Santa Fe', zones: 'Santa Fe · Jardines del Sur', email: 'valeria@zugar.example', phone: '+52 998 555 0103', photo: '', active: true }
  ],

  properties: [
    {
      id: 'ZUG-001', name: 'Casa Ceiba', type: 'Casa', zone: 'Arbolada', city: 'Cancún, Quintana Roo',
      address: 'Calle Ceiba 24, Residencial Arbolada, C.P. 77560', street: 'Calle Ceiba 24',
      op: 'renta', price: 28000, rec: 3, banos: 2, m2: 180, terreno: 160, est: 2, age: 5,
      status: 'disponible', visibility: 'publicada', broker: 'mariana',
      maintenance: 'Incluido en la renta', deposit: 28000, availableFrom: '2026-10-20', furnished: 'Sin amueblar',
      desc: 'Casa de dos niveles con sala y comedor abiertos, cocina integral y jardín privado. La luz natural acompaña cada espacio; ideal para una vida tranquila en Arbolada.',
      amenities: ['Jardín privado', 'Cocina integral', 'Acceso controlado 24/7', 'Se aceptan mascotas'],
      photos: [{ src: 'casa-ceiba.jpg', label: 'Fachada' }, { src: 'casa-ceiba-cocina.jpg', label: 'Cocina' }, { src: 'casa-ceiba-recamara.jpg', label: 'Recámara' }],
      published: '2026-10-13', updated: 'Hoy a las 08:45 h', updatedAt: 6
    },
    {
      id: 'ZUG-002', name: 'Casa del Patio', type: 'Casa', zone: 'Residencial Cumbres', city: 'Cancún, Quintana Roo',
      address: 'Av. Cumbres 118, Residencial Cumbres, C.P. 77560', street: 'Av. Cumbres 118',
      op: 'venta', price: 4850000, rec: 3, banos: 3, m2: 240, terreno: 210, est: 2, age: 3,
      status: 'disponible', visibility: 'publicada', broker: 'diego',
      maintenance: '$2,400 MXN al mes', deposit: 0, availableFrom: '2026-10-01', furnished: 'Sin amueblar',
      desc: 'Residencia de un nivel organizada alrededor de un patio con pérgola de madera. Espacios amplios, techos altos y una terraza para recibir a la familia.',
      amenities: ['Jardín privado', 'Cocina integral', 'Acceso controlado 24/7', 'Terraza', 'Casa club'],
      photos: [{ src: 'casa-del-patio.jpg', label: 'Patio' }],
      published: '2026-09-28', updated: 'Hace 3 días', updatedAt: 5
    },
    {
      id: 'ZUG-003', name: 'Casa Olivo', type: 'Casa', zone: 'Santa Fe', city: 'Cancún, Quintana Roo',
      address: 'Calle Olivo 7, Santa Fe, C.P. 77535', street: 'Calle Olivo 7',
      op: 'renta', price: 22500, rec: 2, banos: 2, m2: 135, terreno: 120, est: 1, age: 8,
      status: 'rentada', visibility: 'pausada', broker: 'valeria',
      maintenance: 'Incluido en la renta', deposit: 22500, availableFrom: '2026-06-01', furnished: 'Semiamueblada',
      desc: 'Casa compacta y luminosa de estilo caribeño, con balcón en planta alta y cocina abierta. Cerca de escuelas y plazas comerciales.',
      amenities: ['Cocina integral', 'Terraza'],
      photos: [{ src: 'casa-olivo.jpg', label: 'Fachada' }],
      published: '2026-05-12', updated: 'Hace 2 semanas', updatedAt: 4
    },
    {
      id: 'ZUG-004', name: 'Casa de la Luz', type: 'Casa', zone: 'Lagos del Sol', city: 'Cancún, Quintana Roo',
      address: 'Paseo Lagos del Sol 52, C.P. 77560', street: 'Paseo Lagos del Sol 52',
      op: 'venta', price: 6200000, rec: 4, banos: 4, m2: 320, terreno: 300, est: 3, age: 2,
      status: 'reservada', visibility: 'publicada', broker: 'diego',
      maintenance: '$3,100 MXN al mes', deposit: 0, availableFrom: '2026-11-15', furnished: 'Sin amueblar',
      desc: 'Residencia de dos niveles con grandes ventanales, alberca privada y vista a las áreas verdes del residencial.',
      amenities: ['Alberca', 'Jardín privado', 'Casa club', 'Acceso controlado 24/7', 'Terraza'],
      photos: [{ src: 'casa-de-la-luz.jpg', label: 'Fachada' }],
      published: '2026-09-02', updated: 'Ayer a las 16:20 h', updatedAt: 3
    },
    {
      id: 'ZUG-005', name: 'Casa Nativa', type: 'Casa en condominio', zone: 'Aqua Residencial', city: 'Cancún, Quintana Roo',
      address: 'Circuito Aqua 31, Aqua Residencial, C.P. 77560', street: 'Circuito Aqua 31',
      op: 'renta', price: 35000, rec: 3, banos: 3, m2: 210, terreno: 180, est: 2, age: 4,
      status: 'disponible', visibility: 'publicada', broker: 'mariana',
      maintenance: 'Incluido en la renta', deposit: 35000, availableFrom: '2026-11-01', furnished: 'Amueblada',
      desc: 'Casa con fachada de madera y piedra, alberca y terraza techada. Se entrega amueblada y lista para habitar.',
      amenities: ['Alberca', 'Amueblada', 'Se aceptan mascotas', 'Acceso controlado 24/7', 'Terraza'],
      photos: [{ src: 'casa-nativa.jpg', label: 'Alberca' }],
      published: '2026-10-05', updated: 'Hace 4 días', updatedAt: 2
    },
    {
      id: 'ZUG-006', name: 'Casa Almendra', type: 'Casa', zone: 'Jardines del Sur', city: 'Cancún, Quintana Roo',
      address: 'Calle Almendro 15, Jardines del Sur, C.P. 77536', street: 'Calle Almendro 15',
      op: 'venta', price: 3450000, rec: 3, banos: 2, m2: 165, terreno: 150, est: 2, age: 6,
      status: 'borrador', visibility: 'borrador', broker: 'valeria',
      maintenance: '$1,200 MXN al mes', deposit: 0, availableFrom: '2026-11-01', furnished: 'Sin amueblar',
      desc: 'Casa familiar con cochera para dos autos y jardín frontal, en una zona tranquila del sur de Cancún.',
      amenities: ['Jardín privado', 'Cocina integral'],
      photos: [],
      published: '', updated: 'Hace 1 semana', updatedAt: 1
    }
  ],

  people: [
    { id: 'p1', name: 'Ana García López', email: 'ana@example.com', phone: '998 000 0123', type: 'cliente', property: 'ZUG-001', broker: 'mariana', follow: 'Visita confirmada', op: 'Renta', budget: '$30,000 MXN / mes', needs: '3 recámaras · 2 personas · 1 perro pequeño', job: 'Diseño de interiores · Nacionalidad mexicana' },
    { id: 'p2', name: 'Jorge Ramírez', email: 'jorge.r@example.com', phone: '998 555 0124', type: 'cliente', property: 'ZUG-002', broker: 'diego', follow: 'Por confirmar', op: 'Compra', budget: '$5,000,000 MXN', needs: '3 recámaras · 4 personas · Sin mascotas', job: 'Ingeniería civil · Nacionalidad mexicana' },
    { id: 'p3', name: 'Sofía Martínez', email: 'sofia.m@example.com', phone: '998 555 0125', type: 'cliente', property: 'ZUG-005', broker: 'mariana', follow: 'Visita confirmada', op: 'Renta', budget: '$36,000 MXN / mes', needs: '3 recámaras · 3 personas · 1 gato', job: 'Medicina · Nacionalidad mexicana' },
    { id: 'p4', label: 'Inquilina', name: 'Carolina Pérez', email: 'carolina.p@example.com', phone: '998 555 0126', type: 'inquilino', property: 'ZUG-003', broker: 'valeria', follow: 'Contrato vigente', op: 'Renta', budget: '$22,500 MXN / mes', needs: 'Contrato compartido · 2 personas', job: 'Hotelería · Nacionalidad mexicana' },
    { id: 'p5', name: 'Andrés Torres', email: 'andres.t@example.com', phone: '998 555 0127', type: 'cliente', property: 'ZUG-004', broker: 'diego', follow: 'Reservada', op: 'Compra', budget: '$6,500,000 MXN', needs: '4 recámaras · 5 personas · 2 perros', job: 'Empresario · Nacionalidad mexicana' },
    { id: 'p6', name: 'Laura Medina', email: 'laura.m@example.com', phone: '998 555 0128', type: 'cliente', property: 'ZUG-005', broker: 'mariana', follow: 'En seguimiento', op: 'Renta', budget: '$32,000 MXN / mes', needs: '3 recámaras · 2 personas · Sin mascotas', job: 'Arquitectura · Nacionalidad colombiana' },
    { id: 'p7', name: 'Miguel Castillo', email: 'miguel.c@example.com', phone: '998 555 0129', type: 'inquilino', property: 'ZUG-003', broker: 'valeria', follow: 'Contrato vigente', op: 'Renta', budget: '$22,500 MXN / mes', needs: 'Contrato compartido · 2 personas', job: 'Gastronomía · Nacionalidad mexicana' },
    { id: 'p8', name: 'Elena Ruiz', email: 'elena.r@example.com', phone: '998 555 0130', type: 'cliente', property: 'ZUG-006', broker: 'valeria', follow: 'Nuevo contacto', op: 'Compra', budget: '$3,500,000 MXN', needs: '3 recámaras · 3 personas · Sin mascotas', job: 'Docencia · Nacionalidad mexicana' }
  ],

  appointments: [
    { id: 'CIT-020', person: 'p5', property: 'ZUG-004', broker: 'diego', date: '2026-10-20', start: '09:00', end: '09:45', status: 'realizada', kind: 'Presencial', note: '' },
    { id: 'CIT-021', person: 'p6', property: 'ZUG-005', broker: 'mariana', date: '2026-10-21', start: '16:00', end: '16:45', status: 'cancelada', kind: 'Presencial', note: 'Pidió reprogramar para noviembre.' },
    { id: 'CIT-024', person: 'p1', property: 'ZUG-001', broker: 'mariana', date: '2026-10-24', start: '10:00', end: '10:45', status: 'confirmada', kind: 'Presencial', note: 'Nos gustaría conocer el patio y la iluminación de la casa por la mañana.', confirmedBy: 'Confirmada por Mariana · 20 oct., 08:45 h.' },
    { id: 'CIT-025', person: 'p2', property: 'ZUG-002', broker: 'diego', date: '2026-10-24', start: '12:30', end: '13:15', status: 'por-confirmar', kind: 'Presencial', note: 'Quiere revisar la terraza y el estado de la cocina.' },
    { id: 'CIT-026', person: 'p3', property: 'ZUG-005', broker: 'mariana', date: '2026-10-25', start: '11:00', end: '11:45', status: 'confirmada', kind: 'Presencial', note: 'Viene con su pareja; preguntan por el reglamento de mascotas.', confirmedBy: 'Confirmada por Mariana · 19 oct., 18:10 h.' }
  ],

  activity: [
    { when: 'Hoy · 08:45 h', text: 'Mariana confirmó la visita de Ana a Casa Ceiba.' },
    { when: 'Ayer · 16:20 h', text: 'Diego marcó Casa de la Luz como reservada.' }
  ],

  history: {
    'ZUG-001': [
      { when: '20 oct. 2026 · 08:45 h', text: 'Mariana Solís confirmó la visita de Ana García López (CIT-024).' },
      { when: '13 oct. 2026 · 10:30 h', text: 'Propiedad publicada en el catálogo público.' },
      { when: '12 oct. 2026 · 17:05 h', text: 'Lucía Méndez creó la propiedad y asignó a Mariana Solís.' }
    ]
  },

  nextNumbers: { property: 7, appointment: 27, person: 9 }
};
