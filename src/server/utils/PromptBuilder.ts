import {
  AIEmailTemplateDto,
  AIOnDeckTemplateDto,
  AIPushTemplateDto,
  AISlackTemplateDto,
  AITeamsTemplateDto,
} from '../../shared-library/types/Dto/AITemplateDtos';

export class PromptBuilder {
  public static emailPrompt(templateData: AIEmailTemplateDto): string {
    return `
    Create three email templates based on the following details:

    - **Template Name:** ${templateData.templateName}
    - **Purpose:** ${templateData.purpose}
    - **Marketing Type:** ${templateData.marketing || 'N/A'}
    - **Urgency Level:** ${templateData.urgency || 'N/A'}
    - **Email Length:** ${templateData.emailLength || 'N/A'}
    - **Sales Intensity:** ${templateData.salesIntensity || 'N/A'}
    - **Additional Instructions:** ${templateData.additionalInstructions || 'N/A'}

    **Instructions:**

    - The output should be a JSON array with the following structure:
      [
        {
          "templateName": "Template Name",
          "subject": "Subject of the email",
          "content": "Email content"
        },
        {
          "templateName": "Template Name",
          "subject": "Subject of the email",
          "content": "Email content"
        },
        {
          "templateName": "Template Name",
          "subject": "Subject of the email",
          "content": "Email content"
        }
      ]

    - **Do not** include any code fences, additional text, or explanations. Only return the JSON array.
    - Ensure that the output is valid JSON.
    `;
  }

  public static onDeckPrompt(templateData: AIOnDeckTemplateDto): string {
    return `
    Create three OnDeck notification templates based on the following details:

    - **Template Name:** ${templateData.templateName}
    - **Purpose:** ${templateData.purpose}
    - **Action URL:** ${templateData.actionUrl}
    - **Additional Instructions:** ${templateData.additionalInstructions || 'N/A'}

    **Instructions:**

    - The output should be a JSON array with the following structure:
      [
        {
          "templateName": "Template Name",
          "title": "Title of the message",
          "composedMessage": "Composed message",
          "actionUrl": "Action URL"
        },
        {
          "templateName": "Template Name",
          "title": "Title of the message",
          "composedMessage": "Composed message",
          "actionUrl": "Action URL"
        },
        {
          "templateName": "Template Name",
          "title": "Title of the message",
          "composedMessage": "Composed message",
          "actionUrl": "Action URL"
        }
      ]

    - **Do not** include any code fences, additional text, or explanations. Only return the JSON array.
    - Leave Action URL value empty if undefined.
    - Ensure that the output is valid JSON.
    `;
  }

  public static pushPrompt(templateData: AIPushTemplateDto): string {
    return `
    Create three push notification templates based on the following details:

    - **Template Name:** ${templateData.templateName}
    - **Purpose:** ${templateData.purpose}
    - **Additional Instructions:** ${templateData.additionalInstructions || 'N/A'}

    **Instructions:**

    - The output should be a JSON array with the following structure:
      [
        {
          "templateName": "Template Name",
          "title": "Title of the message",
          "composedMessage": "Composed message"
        },
        {
          "templateName": "Template Name",
          "title": "Title of the message",
          "composedMessage": "Composed message"
        },
        {
          "templateName": "Template Name",
          "title": "Title of the message",
          "composedMessage": "Composed message"
        }
      ]

    - **Do not** include any code fences, additional text, or explanations. Only return the JSON array.
    - Ensure that the output is valid JSON.
    `;
  }

  public static slackPrompt(templateData: AISlackTemplateDto): string {
    return `
    Create three Slack message templates based on the following details:

    - **Template Name:** ${templateData.templateName}
    - **Purpose:** ${templateData.purpose}
    - **Audience:** ${templateData.audience || 'N/A'}
    - **Mentions:** ${templateData.mentions || 'N/A'}
    - **Urgency Level:** ${templateData.urgency || 'N/A'}
    - **Additional Instructions:** ${templateData.additionalInstructions || 'N/A'}

    **Instructions:**

    - The output should be a JSON array with the following structure:
      [
        {
          "templateName": "Template Name",
          "composedMessage": "Composed message"
        },
        {
          "templateName": "Template Name",
          "composedMessage": "Composed message"
        },
        {
          "templateName": "Template Name",
          "composedMessage": "Composed message"
        }
      ]

    - **Do not** include any code fences, additional text, or explanations. Only return the JSON array.
    - Ensure that the output is valid JSON.
    `;
  }

  public static teamsPrompt(templateData: AITeamsTemplateDto): string {
    return `
    Create three Microsoft Teams message templates based on the following details:

    - **Template Name:** ${templateData.templateName}
    - **Purpose:** ${templateData.purpose}
    - **Audience:** ${templateData.audience || 'N/A'}
    - **Mentions:** ${templateData.mentions || 'N/A'}
    - **Urgency Level:** ${templateData.urgency || 'N/A'}
    - **Additional Instructions:** ${templateData.additionalInstructions || 'N/A'}

    **Instructions:**

    - The output should be a JSON array with the following structure:
      [
        {
          "templateName": "Template Name",
          "text": "Teams message text"
        },
        {
          "templateName": "Template Name",
          "text": "Teams message text"
        },
        {
          "templateName": "Template Name",
          "text": "Teams message text"
        }
      ]

    - **Do not** include any code fences, additional text, or explanations. Only return the JSON array.
    - Ensure that the output is valid JSON.
    `;
  }
}
