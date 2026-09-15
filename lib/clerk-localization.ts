import { esES } from "@clerk/localizations";

/**
 * Dos trabajos:
 *
 * 1. El español de Clerk trata de usted ("Ingrese su…", "Regístrese") y el
 *    resto de la app tutea.
 * 2. Los títulos y pies de las pantallas de auth se definen aquí, no en el
 *    markup. Es la vía soportada: así la tarjeta la dibuja Clerk entera y no
 *    hay que envolverla ni duplicar encabezados.
 */
export const clerkLocalization = {
  ...esES,
  formFieldLabel__emailAddress: "Correo",
  formFieldInputPlaceholder__emailAddress: "tu@correo.com",
  formFieldInputPlaceholder__emailAddress_username: "tu correo o usuario",
  formButtonPrimary: "Continuar",
  dividerText: "o",
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: "Volviste",
      subtitle:
        "Te llega un código al correo y entras. No hay contraseña que recordar.",
      actionText: "¿Todavía no tienen su carpeta?",
      actionLink: "Ábranla aquí",
    },
    emailCode: {
      ...esES.signIn?.emailCode,
      title: "Revisa tu correo",
      subtitle: "Te enviamos un código para entrar.",
      formTitle: "Código de acceso",
      resendButton: "Reenviar el código",
    },
  },
  /* Clerk llama "organización" a lo que aquí es una boda. Traducirlo importa:
     si no, la app suena a herramienta de empresa en la parte que más se
     comparte, que es justo la de invitar a alguien. */
  organizationList: {
    ...esES.organizationList,
    title: "Elige una boda",
    titleWithoutPersonal: "Elige una boda",
    subtitle: "para entrar a {{applicationName}}",
    action__createOrganization: "Abrir otra boda",
    createOrganization: "Abrir otra boda",
    action__invitationAccept: "Unirme",
    invitationAcceptedLabel: "Ya estás dentro",
  },
  createOrganization: {
    ...esES.createOrganization,
    title: "Abran su boda",
    formButtonSubmit: "Crear la boda",
    invitePage: {
      ...esES.createOrganization?.invitePage,
      formButtonReset: "Ahora no",
    },
  },
  organizationSwitcher: {
    ...esES.organizationSwitcher,
    action__createOrganization: "Abrir otra boda",
    action__manageOrganization: "Ver quién está",
    action__invitationAccept: "Unirme",
    notSelected: "Ninguna boda elegida",
    personalWorkspace: "Sin boda",
  },
  organizationProfile: {
    ...esES.organizationProfile,
    navbar: {
      ...esES.organizationProfile?.navbar,
      title: "La boda",
      description: "Quién puede verla y editarla.",
    },
    start: {
      ...esES.organizationProfile?.start,
      headerTitle__general: "La boda",
      headerTitle__members: "Quiénes están",
      profileSection: {
        ...esES.organizationProfile?.start?.profileSection,
        title: "Nombre de la boda",
        primaryButton: "Cambiar el nombre",
      },
    },
    profilePage: {
      ...esES.organizationProfile?.profilePage,
      title: "La boda",
      dangerSection: {
        ...esES.organizationProfile?.profilePage?.dangerSection,
        title: "Cuidado",
        leaveOrganization: {
          ...esES.organizationProfile?.profilePage?.dangerSection
            ?.leaveOrganization,
          title: "Salirme de esta boda",
          messageLine1:
            "¿Seguro que quieres salirte? Dejarás de ver los trámites, los gastos y todo lo demás.",
          messageLine2: "No se puede deshacer.",
          actionDescription: 'Escribe "{{organizationName}}" para confirmar.',
          successMessage: "Saliste de la boda.",
        },
        deleteOrganization: {
          ...esES.organizationProfile?.profilePage?.dangerSection
            ?.deleteOrganization,
          title: "Borrar la boda",
          messageLine1:
            "¿Seguro que quieres borrarla? Se pierde para todos, no solo para ti.",
          messageLine2: "No se puede deshacer.",
          actionDescription: 'Escribe "{{organizationName}}" para confirmar.',
          successMessage: "La boda se borró.",
        },
      },
    },
    invitePage: {
      ...esES.organizationProfile?.invitePage,
      title: "Invitar a la boda",
      subtitle: "Pon su correo. Verá y editará lo mismo que tú.",
      formButtonPrimary__continue: "Enviar la invitación",
      selectDropdown__role: "Qué podrá hacer",
      successMessage: "Invitación enviada.",
      detailsTitle__inviteFailed:
        "No se pudo enviar. Revisa esto y vuelve a intentar:",
    },
    membersPage: {
      ...esES.organizationProfile?.membersPage,
      detailsTitle__emptyRow: "Todavía no hay nadie más",
      activeMembersTab: {
        ...esES.organizationProfile?.membersPage?.activeMembersTab,
        menuAction__remove: "Sacar de la boda",
        tableHeader__user: "Quién",
        tableHeader__joined: "Entró",
        tableHeader__role: "Qué puede hacer",
        tableHeader__actions: "",
      },
    },
  },
  /* La tarea que ve un usuario recién registrado, antes de entrar. Es la
     primera pantalla después del código, así que aquí "organización" chirría
     más que en ningún otro sitio. */
  taskChooseOrganization: {
    ...esES.taskChooseOrganization,
    chooseOrganization: {
      ...esES.taskChooseOrganization?.chooseOrganization,
      title: "¿En qué boda entras?",
      subtitle: "Abre la suya o únete a una a la que te hayan invitado.",
      subtitle__createOrganizationDisabled: "Únete a una boda a la que te hayan invitado.",
      action__createOrganization: "Abrir nuestra boda",
      action__invitationAccept: "Unirme",
    },
    createOrganization: {
      ...esES.taskChooseOrganization?.createOrganization,
      title: "Abran su boda",
      subtitle: "Ponle un nombre. Después invitas a quien organiza contigo.",
      formFieldLabel__name: "Nombre de la boda",
      formFieldInputPlaceholder__name: "Ana y Luis",
      formButtonSubmit: "Crear la boda",
      formButtonReset: "Cancelar",
    },
    organizationCreationDisabled: {
      ...esES.taskChooseOrganization?.organizationCreationDisabled,
      title: "Necesitas una invitación",
      subtitle: "Pídele a quien abrió la boda que te invite por correo.",
    },
  },
  formFieldLabel__organizationName: "Nombre de la boda",
  formFieldInputPlaceholder__organizationName: "Ana y Luis",

  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      title: "Abran su carpeta",
      subtitle:
        "Pon tu correo y te llega un código. Después invitas a quien organiza contigo.",
      actionText: "¿Ya tienes cuenta?",
      actionLink: "Entra aquí",
    },
    emailCode: {
      ...esES.signUp?.emailCode,
      title: "Revisa tu correo",
      subtitle: "Te enviamos un código para confirmar tu cuenta.",
      formTitle: "Código de confirmación",
      resendButton: "Reenviar el código",
    },
  },
} satisfies typeof esES;
