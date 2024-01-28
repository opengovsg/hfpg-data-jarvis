import os
import time
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_ASSISTANT_ID = os.environ.get("OPENAI_ASSISTANT_ID")
OPENAI_THREAD_ID = os.environ.get("OPENAI_THREAD_ID")

def main():    
    client = OpenAI()

    my_assistant = client.beta.assistants.retrieve(OPENAI_ASSISTANT_ID)

    ###
    # Create New Thread only if required
    ###
    # empty_thread = client.beta.threads.create()
    # print(empty_thread)
    my_thread = client.beta.threads.messages.list(OPENAI_THREAD_ID)
    print(my_thread, '\n')

    ###
    # Create Message on the thread to prompt the assistant
    ###

    # thread_message = client.beta.threads.messages.create(
    #     OPENAI_THREAD_ID,
    #     role="user",
    #     content="Draw a line graph of the price trends of 4 room flats in bishan, ang mo kio and toa payoh for 2023. Use the price as the y-axis and the months as the x-axis.",
    # )
    # print(thread_message, '\n')

    ###
    # Create new run to and poll for status
    ###

    # run = client.beta.threads.runs.create(
    #     thread_id=OPENAI_THREAD_ID,
    #     assistant_id=OPENAI_ASSISTANT_ID
    # )
    # run_status = run.status

    # while run_status not in ['expired', 'completed', 'failed', 'cancelled']:
    #     print(run_status)
    #     time.sleep(1)
    #     run_status = client.beta.threads.runs.retrieve(
    #         thread_id=OPENAI_THREAD_ID,
    #         run_id=run.id
    #     ).status

    ###
    # Download message responses and graphed image once run is completed
    ###
    # my_thread = client.beta.threads.messages.list(OPENAI_THREAD_ID)
    
    for message in my_thread.data:
        # print(message.content, '\n')
        for i in range(0, len(message.content)):
            if message.content[i].type == 'image_file':
                print(message.content[i].image_file.file_id, '\n')
                file_id = message.content[i].image_file.file_id
                # image_file = client.files.retrieve(file_id)
                # print(image_file)

                api_response = client.files.content(file_id)
                print(api_response.content)

                content = api_response.content
                with open('image.png', 'wb') as f:
                    f.write(content)
                print('File downloaded successfully.')
            elif message.content[i].type == 'text':
                print(message.content[i].text.value, '\n')

if __name__ == "__main__":
    main()