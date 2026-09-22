# Tema claro e escuro

## Resultado
- Adicionar uma opção global para alternar entre **Escuro** e **Claro**.
- Iniciar no modo **Escuro** para novos usuários e manter a última escolha nas próximas visitas.
- Aplicar o tema também às mensagens, janelas e páginas públicas do aplicativo.

## Interface
- Colocar o controle de tema no rodapé do menu lateral, próximo à versão do aplicativo.
- No menu recolhido, mostrar um botão com ícone de sol/lua e identificação ao passar o cursor.
- No menu aberto, mostrar as duas opções de forma clara e compacta.
- Disponibilizar a mesma escolha no menu para celular.

## Detalhes técnicos
- Usar o suporte de tema já instalado no projeto, com a classe `dark` e as cores semânticas existentes.
- Configurar `dark` como tema padrão, sem seguir automaticamente o tema do aparelho.
- Persistir a escolha localmente no navegador.
- Atualizar a versão para **1.2.7** e validar a troca visual nos dois modos.
