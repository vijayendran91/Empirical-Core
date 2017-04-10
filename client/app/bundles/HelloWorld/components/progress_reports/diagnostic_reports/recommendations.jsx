import React from 'react'
import $ from 'jquery'
import LoadingSpinner from '../../shared/loading_indicator.jsx'
import _ from 'underscore'
import Pusher from 'pusher-js'

export default React.createClass({

	getInitialState: function() {
		return {
			loading: true,
			recommendations: [],
			previouslyAssignedRecommendations: [],
			selections: [],
			students: [],
			assigning: false,
			assigned: false
		}
	},

	componentDidMount: function() {
		this.getRecommendationData(this.props.params.classroomId, this.props.params.activityId);
		this.getPreviouslyAssignedRecommendationData(this.props.params.classroomId, this.props.params.activityId);
	},

	componentWillReceiveProps(nextProps) {
		this.setState({
			loading: true,
			assigning: false,
			assigned: false
		});
		this.getRecommendationData(nextProps.params.classroomId, nextProps.params.activityId);
		this.getPreviouslyAssignedRecommendationData(nextProps.params.classroomId, nextProps.params.activityId);
	},

	getRecommendationData: function(classroomId, activityId){
		var that = this;
		$.get('/teachers/progress_reports/recommendations_for_classroom/' + classroomId + '/activity/' + activityId, (data) => {
			that.setState({
				recommendations: JSON.parse(JSON.stringify(data.recommendations)),
				selections: [...data.recommendations],
				students: data.students,
				loading: false
			})
		})
	},

	getPreviouslyAssignedRecommendationData: function(classroomId, activityId) {
		const that = this;
		$.get('/teachers/progress_reports/previously_assigned_recommendations/' + classroomId + '/activity/' + activityId, (data => {
			that.setState({
				previouslyAssignedRecommendations: data.previouslyAssignedRecommendations
			})
		}))
	},

	studentWasAssigned: function(student, previouslyAssignedRecommendation) {
		if (previouslyAssignedRecommendation.students) {
			return previouslyAssignedRecommendation.students.includes(student.id)
		}
	},

	studentIsSelected: function(student, selection) {
		return (_.indexOf(selection.students, student.id) != -1)
	},

	studentIsRecommended: function(student, recommendation) {
		return (_.indexOf(recommendation.students, student.id) != -1)
	},

	toggleSelected: function(student, index) {
		const selections = [...this.state.selections]
		if (this.studentIsSelected(student, selections[index])) {
			selections[index].students = _.reject(selections[index].students, (stud) => stud === student.id)
		} else {
			selections[index].students.push(student.id)
		}
		this.setState({selections: selections})
	},

	assignSelectedPacks: function() {
		this.setState({assigning: true}, () => {
			const classroomId = this.props.params.classroomId;
			let selections = this.state.selections.map((activityPack) => {
				return {
					id: activityPack.activity_pack_id,
					classrooms: [
						{
							id: classroomId,
							student_ids: activityPack.students
						}
					]
				}
			})
			selections = {selections}
			$.ajax({
		  	type : 'POST',
		  	url :  '/teachers/progress_reports/assign_selected_packs/',
		  	dataType: 'json',
		  	contentType: 'application/json',
		  	data: JSON.stringify(selections),
				success: () => {
					this.initializePusher()
				}
			})
		})
	},

	initializePusher: function(){
		// if (process.env.NODE_ENV === 'development') {
		// 	Pusher.logToConsole = true;
		// }
		const params = this.props.params
		const pusher = new Pusher('a253169073ce7474f0ce', {encrypted: true});
		const channel = pusher.subscribe(this.props.params.classroomId);
		const that = this;
		channel.bind('recommendations-assigned', function(data) {
			that.getPreviouslyAssignedRecommendationData(params.classroomId, params.activityId)
			that.setState({assigning: false, assigned: true})
		});
	},

	renderExplanation: function(){
		return (
			<div className='recommendations-explanation-container'>
				<p className="recommendations-explanation">
					Based on the results of the diagnostic, we created a personalized learning plan for each student.
					<br/>Customize your learning plan by selecting the activity packs you would like to assign.
				</p>
			</div>
		)
	},

	renderTopBar: function() {
		return (
			<div className="recommendations-top-bar">
				<div className="recommendations-key">
						<div className="recommendations-key-icon"></div>
						<p>Recommended Activity Packs</p>
						<div className="assigned-recommendations-key-icon"><i className="fa fa-check-circle"/></div>
						<span className="assigned-activity-pack-text">
							<p>Assigned Activity Packs</p>
							<p>Assigned activities will not be assigned again.</p>
						</span>
				</div>
				{this.renderAssignButton()}
			</div>
		)
	},

	renderAssignButton: function() {
		if (this.state.assigning) {
			return (
				<div className="recommendations-assign-button">
					<span>Assigning...</span>
				</div>
			)
		} else if (this.state.assigned) {
			return (
				<div className="recommendations-assign-button">
					<span>Assigned</span>
				</div>
			)
		} else {
			return (
				<div className="recommendations-assign-button" onClick={this.assignSelectedPacks}>
					<span>Assign Activity Packs</span>
				</div>
			)
		}
	},

	renderTableHeader: function() {
		return (
			<div className="recommendations-table-header">
				<div className="recommendations-table-header-name">Name</div>
				{this.renderActivityPackHeaderItems()}
			</div>
		)
	},

	renderActivityPackHeaderItems: function() {
		return this.state.recommendations.map((recommendation) => {
			return (
				<div className="recommendations-table-header-item" key={recommendation.activity_pack_id}>
					<p>{recommendation.name}</p>
					<a href={'/activities/packs/' + recommendation.activity_pack_id} target="_blank">View Pack</a>
				</div>
			)
		})
	},

	renderTableRows: function() {
		return this.state.students.map((student) => {
			return this.renderTableRow(student)
		})
	},

	renderTableRow: function(student) {
		return (
			<div className="recommendations-table-row" key={student.id}>
				<div className="recommendations-table-row-name">{student.name}</div>
				{this.renderActivityPackRowItems(student)}
			</div>
		)
	},

	renderActivityPackRowItems: function(student) {
		return this.state.recommendations.map((recommendation, i) => {
			console.log('i', i)
			console.log(this.state.previouslyAssignedRecommendations[i])
			let checkboxOnClick, check
			let selection = this.state.selections[i]
			let previouslyAssignedRecommendation = this.state.previouslyAssignedRecommendations[i]
			const previouslyAssigned = this.studentWasAssigned(student, previouslyAssignedRecommendation)
				? ' previouslyAssigned '
				: '';
			const recommended = this.studentIsRecommended(student, recommendation)
				? ' recommended '
				: '';
			const selected = this.studentIsSelected(student, selection)
				? ' selected '
				: '';
			checkboxOnClick = previouslyAssigned ? null : this.toggleSelected.bind(null, student, i)
			check = this.renderCheck(previouslyAssigned, selected)

			return (
				<div className={'recommendations-table-row-item' + previouslyAssigned + recommended + selected} key={recommendation.activity_pack_id}>
					<div className="donalito-checkbox" onClick={checkboxOnClick}>
							{check}
						</div>
					<p>{recommendation.name}</p>
				</div>
			)
		})
	},

	renderCheck: function(previouslyAssigned, selected) {
		if (previouslyAssigned) {
			return (
				<i className="fa fa-check-circle"/>
			)
		}
		else if (selected) {
			return (
				<img className="recommendation-check" src="/images/recommendation_check.svg"></img>
			)
		}
	},

	renderBottomBar: function() {
		return (
			<div className="recommendations-bottom-bar">
				{this.renderAssignButton()}
			</div>
		)
	},

	render: function() {
		if (this.state.loading) {
			return <LoadingSpinner/>
		} else {
			return (
				<div>
					{this.renderExplanation()}
					<div className="recommendations-container">
						{this.renderTopBar()}
						{this.renderTableHeader()}
						<div className="recommendations-table-row-wrapper">
      				{this.renderTableRows()}
      			</div>
						{this.renderBottomBar()}
					</div>
				</div>
			)
		}

	}

})
