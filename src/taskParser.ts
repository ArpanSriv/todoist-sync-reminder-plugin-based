import UltimateTodoistSyncForObsidian from "../main";
import { App } from 'obsidian';


interface dataviewTaskObject {
    status: string;
    checked: boolean;
    completed: boolean;
    fullyCompleted: boolean;
    text: string;
    visual: string;
    line: number;
    lineCount: number;
    path: string;
    section: string;
    tags: string[];
    outlinks: string[];
    link: string;
    children: any[];
    task: boolean;
    annotated: boolean;
    parent: number;
    blockId: string;
}
  
interface todoistTaskObject {
    content: string;
    description?: string;
    project_id?: string;
    section_id?: string;
    parent_id?: string;
    order?: number | null;
    labels?: string[];
    priority?: number | null;
    due_string?: string;
    due_date?: string;
    due_datetime?: string;
    due_lang?: string;
    assignee_id?: string;
}
  
let keywords = {
    TODOIST_TAG: "#todoist",
    DUE_DATE: "🗓️|📅|📆|🗓",
    DUE_TIME: "⏰|⏲",
};

const REGEX = {
    TODOIST_TAG: new RegExp(`^[\\s]*[-] \\[[x ]\\] [\\s\\S]*${keywords.TODOIST_TAG}[\\s\\S]*$`, "i"),
    TODOIST_ID: /\[tid::\s*\d+\]/,
    TODOIST_ID_NUM:/\[tid::\s*(.*?)\]/,
    // TODOIST_ID: /\[todoist_id::\s*\d+\]/,
    // TODOIST_ID_NUM:/\[todoist_id::\s*(.*?)\]/,
    TODOIST_LINK:/\[link\]\(.*?\)/,
    DUE_DATE_WITH_EMOJ: new RegExp(`(${keywords.DUE_DATE})\\s?\\d{4}-\\d{2}-\\d{2}`),
    DUE_DATE : new RegExp(`(?:${keywords.DUE_DATE})\\s?(\\d{4}-\\d{2}-\\d{2})`),
    DUE_TIME: new RegExp(`(?:${keywords.DUE_TIME})\\s?(\\d{2}:\\d{2})`),
    PROJECT_NAME: /\[project::\s*(.*?)\]/,
    TASK_CONTENT: {
        REMOVE_PRIORITY: /\s!!([1-4])\s/,
        // REMOVE_TAGS: /(^|\s)(#[a-zA-Z\d\u4e00-\u9fa5-]+)/g,
        REMOVE_TAGS: /(^|\s)(#[\w\d\u4e00-\u9fa5-]+)/g,
        REMOVE_SPACE: /^\s+|\s+$/g,
        REMOVE_DATE: new RegExp(`(${keywords.DUE_DATE})\\s?\\d{4}-\\d{2}-\\d{2}`),
        REMOVE_TIME: new RegExp(`(${keywords.DUE_TIME})\\s?\\d{2}:\\d{2}`),
        REMOVE_INLINE_METADATA: /%%\[\w+::\s*\w+\]%%/,
        REMOVE_CHECKBOX:  /^(-|\*)\s+\[(x|X| )\]\s/,
        REMOVE_CHECKBOX_WITH_INDENTATION: /^([ \t]*)?(-|\*)\s+\[(x|X| )\]\s/,
        REMOVE_TODOIST_LINK: /\[link\]\(.*?\)/,
    },
    ALL_TAGS: /#[\w\u4e00-\u9fa5-]+/g,
    TASK_CHECKBOX_CHECKED: /- \[(x|X)\] /,
    TASK_INDENTATION: /^(\s{2,}|\t)(-|\*)\s+\[(x|X| )\]/,
    TAB_INDENTATION: /^(\t+)/,
    TASK_PRIORITY: /\s!!([1-4])\s/,
    BLANK_LINE: /^\s*$/,
    TODOIST_EVENT_DATE: /(\d{4})-(\d{2})-(\d{2})/
};

export class TaskParser   {
	app:App;
    plugin: UltimateTodoistSyncForObsidian;

	constructor(app:App, plugin:UltimateTodoistSyncForObsidian) {
		//super(app,settings);
		this.app = app;
        this.plugin = plugin;
	}



    
    //convert line text to a task object
    async convertTextToTodoistTaskObject(lineText:string,filepath:string,lineNumber?:number,fileContent?:string) {
        //console.log(`linetext is:${lineText}`)
        
        let hasParent = false
        let parentId = null
        let parentTaskObject = null
        // 检测 parentID
        let textWithoutIndentation = lineText
        if(this.getTabIndentation(lineText) > 0){
        //console.log(`缩进为 ${this.getTabIndentation(lineText)}`)
        textWithoutIndentation = this.removeTaskIndentation(lineText)
        //console.log(textWithoutIndentation)
        //console.log(`这是子任务`)
        //读取filepath
        //const fileContent = await this.plugin.fileOperation.readContentFromFilePath(filepath)
        //遍历 line
        const lines = fileContent.split('\n')
        //console.log(lines)
        for (let i = (lineNumber - 1 ); i >= 0; i--) {
            //console.log(`正在check${i}行的缩进`)
            const line = lines[i]
            //console.log(line)
            //如果是空行说明没有parent
            if(this.isLineBlank(line)){
                break
            }
            //如果tab数量大于等于当前line,跳过
            if (this.getTabIndentation(line) >= this.getTabIndentation(lineText)) {
                    //console.log(`缩进为 ${this.getTabIndentation(line)}`)
                    continue       
            }
            if((this.getTabIndentation(line) < this.getTabIndentation(lineText))){
                //console.log(`缩进为 ${this.getTabIndentation(line)}`)
                if(this.hasTodoistId(line)){
                    parentId = this.getTodoistIdFromLineText(line)
                    hasParent = true
                    //console.log(`parent id is ${parentId}`)
                    parentTaskObject = this.plugin.cacheOperation.loadTaskFromCacheyID(parentId)
                    break
                }
                else{
                    break
                }
            }
        }
    
    
        }
        
        const dueDate = this.getDueDateFromLineText(textWithoutIndentation)
        const dueTime = this.getDueTimeFromLineText(textWithoutIndentation)
        const labels =  this.getAllTagsFromLineText(textWithoutIndentation)
        // console.log(`labels is ${labels}`)

        //dataview format metadata
        //const projectName = this.getProjectNameFromLineText(textWithoutIndentation) ?? this.plugin.settings.defaultProjectName
        //const projectId = await this.plugin.cacheOperation.getProjectIdByNameFromCache(projectName)
        //use tag as project name

        let projectId = this.plugin.cacheOperation.getDefaultProjectIdForFilepath(filepath as string)
        let projectName = this.plugin.cacheOperation.getProjectNameByIdFromCache(projectId)

        if(hasParent){
            projectId = parentTaskObject.projectId
            projectName =this.plugin.cacheOperation.getProjectNameByIdFromCache(projectId)
        }
        if(!hasParent){
                    //匹配 tag 和 peoject
            for (const label of labels){
        
                //console.log(label)
                let labelName = label.replace(/#/g, "");
                // console.log("labelName value = " + labelName)
                let hasProjectId = this.plugin.cacheOperation.getProjectIdByNameFromCache(labelName)
                if(!hasProjectId){
                    continue
                }
                projectName = labelName
                //console.log(`project is ${projectName} ${label}`)
                projectId = hasProjectId
                break
            }
        }


        let content = this.getTaskContentFromLineText(textWithoutIndentation)
        if (content === "") {
            // We use the obsidian's note as default task content
            content = filepath.replace(/^.*[\\/]/, '').replace(".md","");
        }
        const isCompleted = this.isTaskCheckboxChecked(textWithoutIndentation)
        let description = ""
        const todoist_id = this.getTodoistIdFromLineText(textWithoutIndentation)
        const priority = this.getTaskPriority(textWithoutIndentation)
        if(filepath){
            let url = encodeURI(`obsidian://open?vault=${this.app.vault.getName()}&file=${filepath}`)
            description =`[${filepath}](${url})`;
        }
    
        const todoistTask = {
        projectId: projectId,
        content: content || '',
        parentId: parentId || null,
        dueDate: dueDate || '',
        dueTime: dueTime || '',
        labels: labels || [],
        description: description,
        isCompleted:isCompleted,
        todoist_id:todoist_id || null,
        hasParent:hasParent,
        priority:priority
        };
        //console.log(`converted task `)
        //console.log(todoistTask)
        return todoistTask;
    }

    keywords_function(text:string){
        if(text === "TODOIST_TAG"){
            return "#todoist"
        }
        if (text === "DUE_DATE"){
            return "🗓️|📅|📆|🗓"
        }
        if(text === "DUE_TIME"){
            return "⏰|⏲"
        }else {
            return "No such keyword"
        }
        
    }
  
//   Return true or false if the text has a todoist tag
    hasTodoistTag(text:string){
        
        const regex_test = new RegExp(`^[\\s]*[-] \\[[x ]\\] [\\s\\S]*${this.keywords_function("TODOIST_TAG")}[\\s\\S]*$`, "i");
        
        // console.log("Value of regex_test = " + regex_test)

        return(regex_test.test(text))
        
    }
    
  
//   Return true or false if the text has a todoist id
    hasTodoistId(text:string){
        // const return_old = REGEX.TODOIST_ID.test(text)

        const return_new=new RegExp(`\\[tid::\\s*\\d+\\]`).test(text)
        return(return_new)
    }
  
//   Return true or false if the text has a due date
    hasDueDate(text:string){
        //     DUE_DATE_WITH_EMOJ: new RegExp(`(${keywords.DUE_DATE})\\s?\\d{4}-\\d{2}-\\d{2}`),
        const regex_test = new RegExp(`(${keywords.DUE_DATE})\\s?\\d{4}-\\d{2}-\\d{2}`);
        
        return(regex_test.test(text))  
        // return(REGEX.DUE_DATE_WITH_EMOJ.test(text))
    }
  
  
    // Get the due date from the text
    getDueDateFromLineText(text: string) {
  
        const regex_test = new RegExp(`(?:${this.keywords_function("DUE_DATE")})\\s?(\\d{4}-\\d{2}-\\d{2})`);

        const due_date = regex_test.exec(text);

        if (due_date === null){
            return null;
        }

        // Return the due date value without the emoji
        return due_date[1]
    }

    // Get the duetime from the text
    getDueTimeFromLineText(text: string) {
        const current_time = REGEX.DUE_TIME.exec(text);
        console.log("current time is: " + current_time)
        if(current_time){
            return current_time[1]
        }
        else {
            console.log("No time was provided, so it defaults to 11:59 to avoid breaking things with UTC")
            // TODO Needs to find a better solution, because when it converts to UTC it can change the date, which create a loop of updates
            return "11:59"
        }

    }

  
//   Get the project name from the text
    getProjectNameFromLineText(text:string){
        const result = REGEX.PROJECT_NAME.exec(text);
        return result ? result[1] : null;
    }
  
//   Get the todoist id from the text
    getTodoistIdFromLineText(text:string){
        //console.log(text)
        const result = REGEX.TODOIST_ID_NUM.exec(text);
        //console.log(result)
        return result ? result[1] : null;
    }
  
    // get the duedate from dataview
    getDueDateFromDataview(dataviewTask:object){
        if(!dataviewTask.due){
        return ""
        }
        else{
        const dataviewTaskDue = dataviewTask.due.toString().slice(0, 10)
        return(dataviewTaskDue)
        }

    }
  
  
  
    /*
    //convert line task to dataview task object
    async  getLineTask(filepath,line){
        //const tasks = this.app.plugins.plugins.dataview.api.pages(`"${filepath}"`).file.tasks
        const tasks = await getAPI(this.app).pages(`"${filepath}"`).file.tasks
        const tasksValues = tasks.values
        //console.log(`dataview filepath is ${filepath}`)
        //console.log(`dataview line is ${line}`)
        //console.log(tasksValues)
        const currentLineTask = tasksValues.find(obj => obj.line === line )	
        console.log(currentLineTask)
        return(currentLineTask)
    
    }
    */
  
  
//   Remove everything that is not the task content
    getTaskContentFromLineText(lineText:string) {
        const TaskContent = lineText.replace(REGEX.TASK_CONTENT.REMOVE_INLINE_METADATA,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_TODOIST_LINK,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_PRIORITY," ") //priority 前后必须都有空格，
                                    .replace(REGEX.TASK_CONTENT.REMOVE_TAGS,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_DATE,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_TIME,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_CHECKBOX,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_CHECKBOX_WITH_INDENTATION,"")
                                    .replace(REGEX.TASK_CONTENT.REMOVE_SPACE,"")
        return(TaskContent)
    }
  
  
    //get all tags from task text
    getAllTagsFromLineText(lineText:string){
        let tags = lineText.match(REGEX.ALL_TAGS);

        console.log("tags value is: " + tags)
    
        if (tags) {
            // Remove '#' from each tag
            tags = tags.map(tag => tag.replace('#', ''));
        }

        console.log("value of tags = " + tags)
    
        return tags;
    }
  
    //get checkbox status
    isTaskCheckboxChecked(lineText:string) {
        return(REGEX.TASK_CHECKBOX_CHECKED.test(lineText))
    }
  
  
    //task content compare
    taskContentCompare(lineTask:Object,todoistTask:Object) {
        const lineTaskContent = lineTask.content
        //console.log(dataviewTaskContent)
        
        const todoistTaskContent = todoistTask.content
        //console.log(todoistTask.content)

        //content 是否修改
        const contentModified = (lineTaskContent === todoistTaskContent)
        return(contentModified)  
    }
  
  
    //tag compare
    taskTagCompare(lineTask:Object,todoistTask:Object) {
    
    
        const lineTaskTags = lineTask.labels
        //console.log(dataviewTaskTags)
        
        const todoistTaskTags = todoistTask.labels
        //console.log(todoistTaskTags)
    
        //content 是否修改
        const tagsModified  = lineTaskTags.length === todoistTaskTags.length && lineTaskTags.sort().every((val, index) => val === todoistTaskTags.sort()[index]);
        return(tagsModified) 
    }
  
    //task status compare
    taskStatusCompare(lineTask:Object,todoistTask:Object) {
        //status 是否修改
        const statusModified = (lineTask.isCompleted === todoistTask.isCompleted)
        //console.log(lineTask)
        //console.log(todoistTask)
        return(statusModified)
    }
  
  
    //Compare if the due date from Obsidian is the same due date from Todoist
    async  compareTaskDueDate(lineTask: object, todoistTask: object): Promise<boolean> {

        console.log("compareTaskDueDate started...")

        console.log("lineTask value = " + JSON.stringify(lineTask))
        console.log("todoistTask value = " + JSON.stringify(todoistTask))

        const lineTaskDue = JSON.stringify(lineTask.dueDate)
        const todoistTaskDue = todoistTask.due ?? "";
        const todoistTaskDueDate = JSON.stringify(todoistTaskDue.date);

        console.log("lineTaskDue value is: " + lineTaskDue + " and todoistTaskDueDate value is: " + todoistTaskDueDate)
 

        // if any falue is empty, return false as you can't compare
        if ((lineTaskDue || todoistTaskDueDate) === "") {
            console.log("One of the dates had empty values, so the comparison will fail.")
            return false;
        }

        // if both values are the same, return false because there is no change
        if (lineTaskDue == todoistTaskDueDate) {
            console.log('lineTaskDue == todoistTaskDueDate, returning false on compareTaskDueDate')
            return false;
        }

        // If any has a invvalid date, return false as you can't compare
        else if (lineTaskDue.toString() === "Invalid Date" || todoistTaskDue.toString() === "Invalid Date") {
            console.log('invalid date on compareTaskDueDate')
            return false;
        }
        // If everything above is false, than return true because the dates are different
        else {
            console.log('Something is different in the dates, so returning true on compareTaskDueDate')
            return true;
        }
    }

    // Compare if the due time from Obsidian is the same due time from Todoist
    async  compareTaskDueTime(lineTask: object, todoistTask: object): Promise<boolean> {
        console.log("compareTaskDueTime started...")

        const lineTaskDueTime = JSON.stringify(lineTask.dueTime)
        const todoistTaskDue = todoistTask.due ?? "";

        const todoistTaskDueTimeLocalClock = JSON.stringify(this.ISOStringToLocalClockTimeString(todoistTaskDue.datetime))

        if(this.plguin.settings.debugMode){
            console.log("todoistTaskDueTimeLocalClock = " + todoistTaskDueTimeLocalClock)
            console.log("lineTaskDueTime value is: " + lineTaskDueTime + " and todoistTaskDueTimeLocalClock value is: " + todoistTaskDueTimeLocalClock)
        }

        // if any value is empty, return false as you can't compare
        if((lineTaskDueTime || todoistTaskDueTimeLocalClock) === ""){
            console.log("One of the times had empty values, so the comparison will fail.")
            return false;
        }

        // if both values are the same, return false because there is no change
        if (lineTaskDueTime == todoistTaskDueTimeLocalClock) {
            console.log('lineTaskDueTime == todoistTaskDueTimeLocalClock, returning false on compareTaskDueTime')
            return false;
        }

        else { 
            console.log('Something is different in the times, so returning true on compareTaskDueTime')
            return true;
        }
    }
    
  
    //task project id compare
    async  taskProjectCompare(lineTask:Object,todoistTask:Object) {
        //project 是否修改
        //console.log(dataviewTaskProjectId)
        //console.log(todoistTask.projectId)
        return(lineTask.projectId === todoistTask.projectId)
    }
  
  
    //判断任务是否缩进
    isIndentedTask(text:string) {
        return(REGEX.TASK_INDENTATION.test(text));
    }
  
  
    //判断制表符的数量
    //console.log(getTabIndentation("\t\t- [x] This is a task with two tabs")); // 2
    //console.log(getTabIndentation("  - [x] This is a task without tabs")); // 0
    getTabIndentation(lineText:string){
        const match = REGEX.TAB_INDENTATION.exec(lineText)
        return match ? match[1].length : 0;
    }


    //	Task priority from 1 (normal) to 4 (urgent).
    getTaskPriority(lineText:string): number{
        const match = REGEX.TASK_PRIORITY.exec(lineText)
        return match ? Number(match[1]) : 1;
    }
  
  
  
    //remove task indentation
    removeTaskIndentation(text) {
        const regex = /^([ \t]*)?- \[(x| )\] /;
        return text.replace(regex, "- [$2] ");
    }
  
  
    //判断line是不是空行
    isLineBlank(lineText:string) {
        return(REGEX.BLANK_LINE.test(lineText))
    }
  
  
  //在linetext中插入日期
    insertDueDateBeforeTodoist(text, dueDate) {
        const regex = new RegExp(`(${keywords.TODOIST_TAG})`)
        return text.replace(regex, `📅 ${dueDate} $1`);
  }

    //extra date from obsidian event
    // 使用示例
    //const str = "2023-03-27T15:59:59.000000Z";
    //const dateStr = ISOStringToLocalDateString(str);
    //console.log(dateStr); // 输出 2023-03-27
    ISOStringToLocalDateString(utcTimeString:string) {
        try {
          if(utcTimeString === null){
            return null
          }
          const utcDateString = utcTimeString;
          const dateObj = new Date(utcDateString); // 将UTC格式字符串转换为Date对象

          console.log("Inside taskParser.ts the dateObj now is: " + JSON.stringify(dateObj))
          const year = dateObj.getFullYear();
          const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
          const date = dateObj.getDate().toString().padStart(2, '0');
          const localDateString = `${year}-${month}-${date}`;

          return localDateString;
          return(localDateString);
        } catch (error) {
          console.error(`Error extracting date from string '${utcTimeString}': ${error}`);
          return null;
        }
    }


    //This is a dup from ISOStringToLocalDateString, but parse the time
    ISOStringToLocalClockTimeString(utcTimeString:string) {
        try {
          if(utcTimeString === null){
            return null
          }
          const utcDateString = utcTimeString;
          const dateObj = new Date(utcDateString); // 将UTC格式字符串转换为Date对象

          let timeHour = dateObj.getHours();
          let timeMinute = dateObj.getMinutes();

          let timeHourString;
          let timeMinuteString;

          if(timeMinute<10){
            timeMinuteString = "0" + JSON.stringify(dateObj.getMinutes())
          }else{
            timeMinuteString = JSON.stringify(dateObj.getMinutes())
          }

        //   Fixes the issue of hour and minutes having a single digit
          if(timeHour<10){
            timeHourString = "0" + JSON.stringify(dateObj.getHours())
          }else{
            timeHourString = JSON.stringify(dateObj.getHours())
          }

          
          const localTimeString = `${timeHourString}:${timeMinuteString}`;

          return localTimeString;
          return(localTimeString);
        } catch (error) {
          console.error(`Error extracting date from string '${utcTimeString}': ${error}`);
          return null;
        }
    }




    //extra date from obsidian event
    // 使用示例
    //const str = "2023-03-27T15:59:59.000000Z";
    //const dateStr = ISOStringToLocalDatetimeString(str);
    //console.log(dateStr); // 输出 Mon Mar 27 2023 23:59:59 GMT+0800 (China Standard Time)
    ISOStringToLocalDatetimeString(utcTimeString:string) {
        try {
          if(utcTimeString === null){
            return null
          }
          let utcDateString = utcTimeString;
          let dateObj = new Date(utcDateString); // 将UTC格式字符串转换为Date对象
          let result = dateObj.toString();
          return(result);
        } catch (error) {
          console.error(`Error extracting date from string '${utcTimeString}': ${error}`);
          return null;
        }
    }



    //convert date from obsidian event
    // 使用示例
    //const str = "2023-03-27";
    //const utcStr = localDateStringToUTCDatetimeString(str);
    //console.log(dateStr); // 输出 2023-03-27T00:00:00.000Z
    localDateStringToUTCDatetimeString(localDatetimeString:string) {
        try {
          if(localDatetimeString === null){
            return null
          }
        //   localDatetimeString = localDatetimeString;
          const localDateObj = new Date(localDatetimeString);
          const ISOString = localDateObj.toISOString()
          return(ISOString);
        } catch (error) {
          console.error(`Error extracting date from string '${localDatetimeString}': ${error}`);
          return null;
        }
    }
    
    //convert date from obsidian event
    // 使用示例
    //const str = "2023-03-27";
    //const utcStr = localDateStringToUTCDateString(str);
    //console.log(dateStr); // 输出 2023-03-27
    localDateStringToUTCDateString(localDateString:string) {
        try {
          if(localDateString === null){
            return null
          }
        //   localDateString = localDateString;
          const localDateObj = new Date(localDateString);
          const ISOString = localDateObj.toISOString()
        //   let utcDateString = ISOString.slice(0,10)
          return(ISOString);
        } catch (error) {
          console.error(`Error extracting date from string '${localDateString}': ${error}`);
          return null;
        }
    }
    
    isMarkdownTask(str: string): boolean {
        const taskRegex = /^\s*-\s+\[([x ])\]/;
        return taskRegex.test(str);
    }

    addTodoistTag(str: string): string {
        return(str +` ${keywords.TODOIST_TAG}`);
    }

    getObsidianUrlFromFilepath(filepath:string){
        const url = encodeURI(`obsidian://open?vault=${this.app.vault.getName()}&file=${filepath}`)
        const obsidianUrl =`[${filepath}](${url})`;
        return(obsidianUrl)
    }


    addTodoistLink(linetext: string,todoistLink:string): string {
        const regex = new RegExp(`${keywords.TODOIST_TAG}`, "g");
        return linetext.replace(regex, todoistLink + ' ' + '$&');
    }


    //检查是否包含todoist link
    hasTodoistLink(lineText:string){
        return(REGEX.TODOIST_LINK.test(lineText))
    }
}
