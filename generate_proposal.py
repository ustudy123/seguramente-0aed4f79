from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

def create_pdf():
    doc = SimpleDocTemplate(
        "/mnt/documents/Plano_App_Ponto_YourEyes_v2.pdf",
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    
    # Custom styles based on system palette
    primary_color = colors.HexColor("#7E3CC4")
    accent_color = colors.HexColor("#F58220")
    text_color = colors.HexColor("#2D2636")
    
    styles.add(ParagraphStyle(
        name='MainTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=primary_color,
        spaceAfter=30,
        alignment=TA_CENTER
    ))
    
    styles.add(ParagraphStyle(
        name='SubTitle',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=accent_color,
        spaceBefore=20,
        spaceAfter=12
    ))
    
    styles.add(ParagraphStyle(
        name='NormalJustified',
        parent=styles['Normal'],
        fontSize=11,
        textColor=text_color,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    ))

    styles.add(ParagraphStyle(
        name='BulletPoint',
        parent=styles['Normal'],
        fontSize=11,
        textColor=text_color,
        leftIndent=20,
        bulletIndent=10,
        spaceAfter=5
    ))

    content = []

    # Logo
    try:
        logo_path = "/dev-server/src/assets/logo-YourEyes-branding.png"
        img = Image(logo_path, width=6*cm, height=2*cm)
        img.hAlign = 'CENTER'
        content.append(img)
        content.append(Spacer(1, 1*cm))
    except:
        pass

    # Title
    content.append(Paragraph("Proposta Técnica: App do Colaborador (PWA)", styles['MainTitle']))
    content.append(Paragraph("Solução Integrada para Registro de Ponto e Gestão de Jornada", styles['SubTitle']))
    content.append(Spacer(1, 0.5*cm))

    # Introduction
    content.append(Paragraph("<b>Objetivo</b>", styles['SubTitle']))
    content.append(Paragraph(
        "Este documento detalha a implementação de uma interface exclusiva para colaboradores, "
        "focada na facilidade de uso diário, acessibilidade via dispositivos móveis e conformidade legal (Portaria 671/2021 do MTE). "
        "A solução proposta utiliza a tecnologia <b>PWA (Progressive Web App)</b>, permitindo que o sistema funcione como um aplicativo instalado "
        "no celular do funcionário, mas sem a necessidade de baixar em lojas como Google Play ou App Store.",
        styles['NormalJustified']
    ))

    content.append(PageBreak())

    # The Strategy
    content.append(Paragraph("<b>Abordagem Recomendada: Login Simplificado (Opção B)</b>", styles['SubTitle']))
    content.append(Paragraph(
        "Para equilibrar segurança, custo e experiência do usuário, recomendamos o fluxo de acesso via <b>CPF + PIN de 4 dígitos</b>.",
        styles['NormalJustified']
    ))
    
    content.append(Paragraph("<b>Como funcionará para o colaborador:</b>", styles['NormalJustified']))
    items = [
        "<b>1º Acesso:</b> O colaborador informa o CPF e recebe um código de validação único via WhatsApp.",
        "<b>Definição de PIN:</b> Após validar, ele cadastra uma senha numérica de 4 dígitos (PIN) de sua preferência.",
        "<b>Uso Diário:</b> Para bater o ponto, basta abrir o ícone na tela do celular e digitar o PIN. Não precisa de login complexo todo dia.",
        "<b>Instalação:</b> O sistema exibirá um convite para 'Adicionar à tela de início', criando o ícone do YourEyes ao lado do WhatsApp e outros apps."
    ]
    for item in items:
        content.append(Paragraph(f"• {item}", styles['BulletPoint']))

    content.append(Spacer(1, 0.5*cm))
    content.append(Paragraph("<b>Benefícios desta abordagem:</b>", styles['NormalJustified']))
    benefits = [
        "<b>Redução de Custos:</b> O envio de WhatsApp ocorre apenas no primeiro acesso ou caso o usuário esqueça o PIN.",
        "<b>Agilidade:</b> Registro de ponto em menos de 10 segundos.",
        "<b>Segurança:</b> Validação por CPF e localização geográfica obrigatória.",
        "<b>Acessibilidade:</b> Funciona em qualquer smartphone (Android ou iPhone) sem ocupar memória interna com instalação pesada."
    ]
    for item in benefits:
        content.append(Paragraph(f"• {item}", styles['BulletPoint']))

    content.append(PageBreak())

    # Features
    content.append(Paragraph("<b>Funcionalidades do App (Escopo PWA)</b>", styles['SubTitle']))
    
    features_data = [
        ["Funcionalidade", "Descrição"],
        ["Registro de Ponto", "Entrada, Saída e Intervalos com validação de GPS."],
        ["Saldo de Horas", "Visualização em tempo real do banco de horas/horas extras."],
        ["Espelho de Ponto", "Consulta dos registros realizados no mês atual."],
        ["Ajustes de Ponto", "Solicitação de correção caso esqueça de bater o ponto."],
        ["Notificações Web", "Lembretes diários para não esquecer de registrar a jornada."]
    ]
    
    t = Table(features_data, colWidths=[4*cm, 12*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    content.append(t)
    content.append(Spacer(1, 1*cm))

    # Technical Feasibility
    content.append(Paragraph("<b>Viabilidade Técnica e Prazo</b>", styles['SubTitle']))
    content.append(Paragraph(
        "A estrutura atual do YourEyes já possui 80% da tecnologia necessária. "
        "A implementação focará na criação desta nova interface 'Mobile-First' e no sistema de segurança por PIN.",
        styles['NormalJustified']
    ))
    
    content.append(Paragraph("<b>Plano de Implementação:</b>", styles['NormalJustified']))
    steps = [
        "<b>Fase 1:</b> Criação da rota exclusiva e interface visual do PWA.",
        "<b>Fase 2:</b> Implementação do sistema de PIN e integração com WhatsApp OTP.",
        "<b>Fase 3:</b> Painel de consulta de saldo e espelho de ponto.",
        "<b>Fase 4:</b> Homologação e testes de geolocalização."
    ]
    for step in steps:
        content.append(Paragraph(f"• {step}", styles['BulletPoint']))

    content.append(Spacer(1, 1*cm))
    content.append(Paragraph(
        "<i>Este plano foca exclusivamente na tecnologia PWA para máxima compatibilidade e rapidez de entrega, "
        "garantindo que o colaborador tenha uma experiência de aplicativo sem as burocracias de lojas oficiais.</i>",
        styles['NormalJustified']
    ))

    # Build PDF
    doc.build(content)

if __name__ == "__main__":
    create_pdf()
