from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.units import inch
import os

def generate_pdf():
    file_path = "/mnt/documents/Plano_App_Ponto_Seguramente_Final.pdf"
    doc = SimpleDocTemplate(file_path, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()
    
    # Custom Colors
    primary_color = colors.HexColor("#7E3CC4")
    accent_color = colors.HexColor("#F58220")
    text_color = colors.HexColor("#333333")
    
    # Custom Styles
    styles.add(ParagraphStyle(name='TitleMain', parent=styles['Heading1'], fontSize=24, textColor=primary_color, alignment=1, spaceAfter=20))
    styles.add(ParagraphStyle(name='SubTitle', parent=styles['Heading2'], fontSize=18, textColor=accent_color, spaceBefore=15, spaceAfter=10))
    styles.add(ParagraphStyle(name='BodyTextCustom', parent=styles['Normal'], fontSize=11, textColor=text_color, leading=14, spaceAfter=10, alignment=4))
    styles.add(ParagraphStyle(name='FeatureItem', parent=styles['Normal'], fontSize=11, textColor=text_color, leftIndent=20, bulletIndent=10, spaceAfter=5))

    story = []

    # Logo
    logo_path = "public/lovable-uploads/logo-seguramente.png"
    if os.path.exists(logo_path):
        img = Image(logo_path, width=1.5*inch, height=0.6*inch)
        img.hAlign = 'CENTER'
        story.append(img)
        story.append(Spacer(1, 20))

    # Title
    story.append(Paragraph("Plano de Implementação: Web App do Colaborador", styles['TitleMain']))
    story.append(Spacer(1, 10))
    
    # Intro
    story.append(Paragraph("Proposta Executiva de Solução Digital para Registro de Ponto e Gestão de Jornada", styles['BodyTextCustom']))
    story.append(Spacer(1, 20))

    # Contexto
    story.append(Paragraph("1. Visão Geral", styles['SubTitle']))
    story.append(Paragraph(
        "Este documento detalha a criação de uma solução digital exclusiva para os colaboradores da Seguramente. "
        "O objetivo é facilitar o registro de ponto diário e a consulta de saldo de banco de horas por meio de um "
        "Web App de acesso rápido, seguro e intuitivo.", 
        styles['BodyTextCustom']
    ))

    # O que é o Web App (PWA)
    story.append(Paragraph("2. Tecnologia: Web App (PWA)", styles['SubTitle']))
    story.append(Paragraph(
        "A solução escolhida é um Progressive Web App (PWA). Trata-se de uma tecnologia moderna que permite ao sistema "
        "funcionar como um aplicativo instalado no celular, mas acessado diretamente via navegador.",
        styles['BodyTextCustom']
    ))
    story.append(Paragraph("• <b>Acesso Instantâneo:</b> O colaborador acessa um link e pode adicionar um ícone na tela inicial do celular.", styles['FeatureItem']))
    story.append(Paragraph("• <b>Leve e Rápido:</b> Não ocupa memória significativa no aparelho do colaborador.", styles['FeatureItem']))
    story.append(Paragraph("• <b>Sempre Atualizado:</b> Qualquer melhoria no sistema é refletida instantaneamente para todos.", styles['FeatureItem']))

    # Fluxo de Acesso
    story.append(Paragraph("3. Fluxo de Acesso e Segurança", styles['SubTitle']))
    story.append(Paragraph(
        "Para garantir a segurança jurídica e a facilidade de uso, o acesso foi planejado em duas etapas:",
        styles['BodyTextCustom']
    ))
    
    data = [
        ["Etapa", "Descrição", "Frequência"],
        ["Primeiro Acesso", "Identificação por CPF + Código de Segurança via WhatsApp.", "Apenas 1ª vez"],
        ["Uso Diário", "Acesso simplificado via PIN de 4 dígitos ou Biometria do celular.", "Todos os dias"]
    ]
    t = Table(data, colWidths=[1.5*inch, 2.5*inch, 1.2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    # Funcionalidades
    story.append(Paragraph("4. Funcionalidades Principais", styles['SubTitle']))
    story.append(Paragraph("• <b>Registro de Ponto:</b> Batida de ponto com validação de geolocalização (GPS).", styles['FeatureItem']))
    story.append(Paragraph("• <b>Banco de Horas:</b> Visualização em tempo real do saldo de horas e extrato mensal.", styles['FeatureItem']))
    story.append(Paragraph("• <b>Comprovantes:</b> Acesso rápido aos comprovantes de registro conforme a legislação.", styles['FeatureItem']))
    story.append(Paragraph("• <b>Solicitações:</b> Pedidos de ajuste de ponto ou envio de atestados diretamente pelo app.", styles['FeatureItem']))

    # Viabilidade Legal
    story.append(Paragraph("5. Viabilidade e Conformidade", styles['SubTitle']))
    story.append(Paragraph(
        "A solução está em total conformidade com a <b>Portaria 671/2021 do Ministério do Trabalho</b>, "
        "garantindo a validade jurídica dos registros. Além disso, o sistema respeita a LGPD, "
        "protegendo os dados sensíveis dos colaboradores.",
        styles['BodyTextCustom']
    ))

    # Cronograma
    story.append(Paragraph("6. Cronograma de Implementação", styles['SubTitle']))
    story.append(Paragraph("• <b>Semana 1:</b> Configuração da infraestrutura de acesso e segurança (PIN/WhatsApp).", styles['FeatureItem']))
    story.append(Paragraph("• <b>Semana 2:</b> Desenvolvimento da interface exclusiva do Web App.", styles['FeatureItem']))
    story.append(Paragraph("• <b>Semana 3:</b> Testes de geolocalização e integração com banco de horas.", styles['FeatureItem']))
    story.append(Paragraph("• <b>Semana 4:</b> Lançamento oficial e treinamento dos colaboradores.", styles['FeatureItem']))

    # Conclusão
    story.append(Spacer(1, 30))
    story.append(Paragraph("Conclusão", styles['SubTitle']))
    story.append(Paragraph(
        "A implementação do Web App representa um salto de modernidade para a Seguramente, "
        "reduzindo erros operacionais e aumentando a transparência com o colaborador.",
        styles['BodyTextCustom']
    ))

    # Build PDF
    doc.build(story)
    return file_path

if __name__ == "__main__":
    print(generate_pdf())
