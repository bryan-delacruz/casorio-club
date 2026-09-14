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
