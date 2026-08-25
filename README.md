# TAI Finance

preciso criar um app igual a monday, www.monday.com, que seja gestor de projetos, o nome será TAI Project, precisa ter controle de acesso, o app deve ser mult-empresas, e cada usuario acessa apenas os dados da empresa logada e apenas acesso a empresa atribuida a ele, será 3 tipos de usuários, Supervisor, Gerente e operador, sendo que o Supervisor poderá selecionar outras empresas para interagir com as informações daquela empresa.  O app deverá ter a possibilidade de criar projeto, apresentar de maneira tradicional (lista), Karban e Gantt, , os projetos ficam listados no menu a esquerda, dentro de projeto possibilidade de criar elementos como sub-menu, cada elemento dentro de um card,  e dentro de elementos poder criar tarefas, tarefas tambem será sub-menu de elementos podendo ser expandida, aparecendo as tarefas dentro do card daquele elemento, as tarefas terao opção da descriçao,  valor estimado, observação, status que poderá ser configurado (em configurações poder criar e editar status, com nome, cor e grau de importância ), cronograma podendo ser inserido data inicial e final,  data de criação da tarefa, responsavel e atalho para visualizar arquivos e fotos anexadas. Ao lado de cada tarefa deverá ter um atalho para o chat, que seria anotações dos usuários a respeito daquela tarefa em formato de chat, com a descrição do comentário e o usuário que realizou em letras menores abaixo do comentário, junto da data e hora do comentário.  Para cada novo projeto, elemento ou tarefa, atribua uma cor aleatória diferente, podendo ser editada pelo usuário. Na lista dos elementos, antes de expandir para tarefas, aparecem informações do elemento, como nome,  quantidade de tarefas criadas para o elemento, status (resumido com varias cores e proporção conforme  cada tarefa criada e atribuido um status) e agenda(com marcação de reuniões ou ligações apara terceiros envolvidos). Ao logar no app, o usuario ja visualiza as notificações de ações solicitadas por outro usuário a serem realizadas(ao criar uma agenda, ou atribuir responsabilidade de uma tarefa, o usuário citado deve ser notificado.  O app deve permitir emitir invite para usuário convidado, crie um link de convite onde é informado email e ja definido uma senha para aquele convidado, o link poderá ser copiado e enviado ao convidado, nao precisa estar automatizado para ser enviado por email, o usuario copia e cola no wattsapp, o convidado ao abrir o link, digita o email e a senha fornecida, que deverá consistir com o previamente cadastro pelo usuario, após isso o convidado deve alterar a senha para acessar o sistema, a aprtir disso esse convidado ja aparece como cadastrado como usuário do app, ja definido conforme o caso se é supervisor, gerente ou operador, o mesmo link de convite deverá ser o link de acesso ao app, sendo que se o convidado ja tenha realizado um check in uma vez, o app ja o direciona diretamente para a aplicação. As tarefas poderao ser arrastadas pelo mouse para mudar a sua localização na lista.  O app deverá ter a opção de configurações de usuarios, e perfis de acesso, podendo ser selecionado as telas que poderão acessar e as demais opções do sistema. Se tiver dúvida me pergunte.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://taifinance.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/049eb04b-0035-496f-b7b9-9459a2a731ab).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
